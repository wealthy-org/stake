import type { PoolClient } from "pg";
import { withTransaction, query, queryOne } from "../db/client";
import { ensureSchema } from "../db/schema";
import { toBigInt } from "./units";
import { evaluateComparison, type Comparison } from "./comparison";
import { settlePools, winnerPayout } from "./pool";
import { calcNetLoss } from "./netloss";
import { calcEmission } from "./emission";
import { getResolver } from "../oracle";
import { newMarketId } from "./ids";
import { isPaused, maybeEnableTransfers } from "./admin";
import { MarketError } from "./errors";

export { MarketError };

async function logEvent(client: PoolClient, marketId: string | null, type: string, payload: any) {
  await client.query(
    `INSERT INTO events (market_id, type, payload) VALUES ($1, $2, $3)`,
    [marketId, type, JSON.stringify(payload)]
  );
}

export interface CreateMarketInput {
  question: string;
  assetSymbol: string;
  oracleSource: string; // e.g. "binance:ETHUSDT"
  strikePrice: number;
  comparison: Comparison;
  bettingOpensAt: Date;
  bettingClosesAt: Date;
  resolutionTimestamp: Date;
  resolutionWindowSec: number;
  protocolFeeBps: number;
  minBet: bigint;
  maxBet: bigint;
}

const MAX_PROTOCOL_FEE_BPS = 500; // brief §58 — hard cap, 5%

/** Brief §59 — factory-level parameter validation. */
export async function createMarket(input: CreateMarketInput): Promise<string> {
  await ensureSchema();

  if (await isPaused()) {
    throw new MarketError("protocol is paused — new market creation is blocked (brief §38)", "PAUSED");
  }

  if (!(input.bettingOpensAt < input.bettingClosesAt)) {
    throw new MarketError("bettingOpensAt must be before bettingClosesAt", "INVALID_WINDOW");
  }
  if (!(input.bettingClosesAt <= input.resolutionTimestamp)) {
    throw new MarketError("bettingClosesAt must be <= resolutionTimestamp", "INVALID_WINDOW");
  }
  if (input.resolutionWindowSec <= 0) {
    throw new MarketError("resolutionWindowSec must be > 0", "INVALID_WINDOW");
  }
  if (!(input.strikePrice > 0)) {
    throw new MarketError("strikePrice must be > 0", "INVALID_STRIKE");
  }
  if (input.protocolFeeBps < 0 || input.protocolFeeBps > MAX_PROTOCOL_FEE_BPS) {
    throw new MarketError(`protocolFeeBps must be between 0 and ${MAX_PROTOCOL_FEE_BPS}`, "INVALID_FEE");
  }
  if (!(input.minBet > 0n)) {
    throw new MarketError("minBet must be > 0", "INVALID_BET_BOUNDS");
  }
  if (!(input.maxBet >= input.minBet)) {
    throw new MarketError("maxBet must be >= minBet", "INVALID_BET_BOUNDS");
  }
  if (!input.question.trim()) {
    throw new MarketError("question must not be empty", "INVALID_QUESTION");
  }

  const id = newMarketId();
  const now = new Date();
  // Avoid sitting in `draft` for up to a full worker tick when the betting
  // window already covers "now" at creation time (openDueMarkets covers it
  // afterwards either way, but this makes a just-created market usable immediately).
  const initialStatus = now >= input.bettingOpensAt && now < input.bettingClosesAt ? "open" : "draft";

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO markets (
        id, question, asset_symbol, oracle_source, strike_price, comparison,
        betting_opens_at, betting_closes_at, resolution_timestamp, resolution_window_sec,
        protocol_fee_bps, min_bet, max_bet, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        input.question,
        input.assetSymbol,
        input.oracleSource,
        input.strikePrice,
        input.comparison,
        input.bettingOpensAt,
        input.bettingClosesAt,
        input.resolutionTimestamp,
        input.resolutionWindowSec,
        input.protocolFeeBps,
        input.minBet.toString(),
        input.maxBet.toString(),
        initialStatus,
      ]
    );
    await logEvent(client, id, "MarketCreated", { question: input.question });
  });

  return id;
}

export async function ensureWallet(client: PoolClient, address: string) {
  await client.query(
    `INSERT INTO wallets (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
    [address]
  );
}

/** Virtual faucet top-up — stands in for real deposit flow (brief §18/§65) while there's no contract custody yet. */
export async function faucetTopUp(address: string, amount: bigint): Promise<void> {
  await ensureSchema();
  await withTransaction(async (client) => {
    await ensureWallet(client, address);
    await client.query(
      `UPDATE wallets SET virtual_balance = virtual_balance + $2 WHERE address = $1`,
      [address, amount.toString()]
    );
  });
}

function marketStatusAt(market: any, now: Date): string {
  if (market.status === "resolved" || market.status === "cancelled") return market.status;
  if (now >= new Date(market.resolution_timestamp) && market.status !== "open" && market.status !== "locked") {
    return market.status;
  }
  if (now < new Date(market.betting_opens_at)) return "draft";
  if (now < new Date(market.betting_closes_at)) return "open";
  return "locked";
}

export async function placeBet(params: {
  marketId: string;
  address: string;
  side: "yes" | "no";
  amount: bigint;
}): Promise<void> {
  await ensureSchema();
  const { marketId, address, side, amount } = params;

  if (await isPaused()) {
    throw new MarketError("protocol is paused — new bets are blocked (brief §38)", "PAUSED");
  }

  await withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
    const market = rows[0];
    if (!market) throw new MarketError("market not found", "NOT_FOUND");

    const now = new Date();
    const effectiveStatus = marketStatusAt(market, now);
    if (effectiveStatus !== "open") {
      throw new MarketError(`market is not open for betting (status=${effectiveStatus})`, "NOT_OPEN");
    }

    const minBet = toBigInt(market.min_bet);
    const maxBet = toBigInt(market.max_bet);
    if (amount < minBet || amount > maxBet) {
      throw new MarketError(`amount must be between ${minBet} and ${maxBet}`, "BET_OUT_OF_BOUNDS");
    }

    await ensureWallet(client, address);
    const walletRows = await client.query(`SELECT virtual_balance FROM wallets WHERE address = $1 FOR UPDATE`, [address]);
    const balance = toBigInt(walletRows.rows[0].virtual_balance);
    if (balance < amount) {
      throw new MarketError("insufficient virtual balance", "INSUFFICIENT_BALANCE");
    }

    await client.query(`UPDATE wallets SET virtual_balance = virtual_balance - $2 WHERE address = $1`, [
      address,
      amount.toString(),
    ]);

    await client.query(
      `INSERT INTO bets (market_id, address, side, amount) VALUES ($1,$2,$3,$4)`,
      [marketId, address, side, amount.toString()]
    );

    const poolColumn = side === "yes" ? "yes_pool" : "no_pool";
    await client.query(`UPDATE markets SET ${poolColumn} = ${poolColumn} + $2 WHERE id = $1`, [
      marketId,
      amount.toString(),
    ]);

    await client.query(
      `INSERT INTO positions (market_id, address, yes_stake, no_stake)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (market_id, address) DO UPDATE SET
         yes_stake = positions.yes_stake + EXCLUDED.yes_stake,
         no_stake = positions.no_stake + EXCLUDED.no_stake`,
      [marketId, address, side === "yes" ? amount.toString() : "0", side === "no" ? amount.toString() : "0"]
    );

    if (now >= new Date(market.betting_closes_at)) {
      await client.query(`UPDATE markets SET status = 'locked' WHERE id = $1 AND status = 'open'`, [marketId]);
    } else if (market.status === "draft") {
      await client.query(`UPDATE markets SET status = 'open' WHERE id = $1 AND status = 'draft'`, [marketId]);
    }

    await logEvent(client, marketId, "BetPlaced", { address, side, amount: amount.toString() });
  });
}

/**
 * Moves DRAFT markets whose betting window has started into OPEN (brief §8).
 * Without this, a freshly created market sits in `draft` until its first
 * bet (placeBet flips it lazily) even though betting is already allowed by
 * the timestamps — which hid unbet markets from the board's "Open" tab.
 */
export async function openDueMarkets(): Promise<string[]> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE markets SET status = 'open'
     WHERE status = 'draft' AND betting_opens_at <= now() AND betting_closes_at > now()
     RETURNING id`
  );
  return rows.map((r) => r.id);
}

/** Moves OPEN markets whose betting window has closed into LOCKED (brief §8). Idempotent. */
export async function lockDueMarkets(): Promise<string[]> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE markets SET status = 'locked'
     WHERE status = 'open' AND betting_closes_at <= now()
     RETURNING id`
  );
  for (const row of rows) {
    await withTransaction((client) => logEvent(client, row.id, "MarketLocked", {}));
  }
  return rows.map((r) => r.id);
}

/** Brief §34/§35 — cancel instead of resolving into broken math. */
export async function cancelMarket(marketId: string, reason: string): Promise<void> {
  await ensureSchema();
  await withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
    const market = rows[0];
    if (!market) throw new MarketError("market not found", "NOT_FOUND");
    if (market.status === "resolved") {
      throw new MarketError("cannot cancel a resolved market", "ALREADY_RESOLVED");
    }
    if (market.status === "cancelled") return;

    await client.query(`UPDATE markets SET status = 'cancelled', cancel_reason = $2 WHERE id = $1`, [
      marketId,
      reason,
    ]);
    await logEvent(client, marketId, "MarketCancelled", { reason });
  });
}

/** Refund claim for a cancelled market — original stake back, no fee, no PAPER (brief §29/§53). */
export async function claimRefund(marketId: string, address: string): Promise<bigint> {
  await ensureSchema();
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
    const market = rows[0];
    if (!market) throw new MarketError("market not found", "NOT_FOUND");
    if (market.status !== "cancelled") throw new MarketError("market is not cancelled", "NOT_CANCELLED");

    const posRows = await client.query(
      `SELECT * FROM positions WHERE market_id = $1 AND address = $2 FOR UPDATE`,
      [marketId, address]
    );
    const position = posRows.rows[0];
    if (!position) throw new MarketError("no position for this address", "NO_POSITION");
    if (position.payout_claimed) throw new MarketError("already claimed", "ALREADY_CLAIMED");

    const refund = toBigInt(position.yes_stake) + toBigInt(position.no_stake);
    if (refund <= 0n) throw new MarketError("nothing to refund", "ZERO_REFUND");

    await client.query(`UPDATE positions SET payout_claimed = true WHERE market_id = $1 AND address = $2`, [
      marketId,
      address,
    ]);
    await client.query(`UPDATE wallets SET virtual_balance = virtual_balance + $2 WHERE address = $1`, [
      address,
      refund.toString(),
    ]);
    await logEvent(client, marketId, "RefundClaimed", { address, amount: refund.toString() });

    return refund;
  });
}

/**
 * Resolve a market using the configured oracle. Brief §26/§27: validate the
 * report is inside the accepted resolution window, then settle pools.
 * Brief §34/§35: an empty-sided pool (or zero winning/losing pool) cancels
 * instead of resolving.
 */
export async function resolveMarket(marketId: string): Promise<void> {
  await ensureSchema();

  const market = await queryOne<any>(`SELECT * FROM markets WHERE id = $1`, [marketId]);
  if (!market) throw new MarketError("market not found", "NOT_FOUND");
  if (market.status === "resolved") throw new MarketError("already resolved", "ALREADY_RESOLVED");
  if (market.status === "cancelled") throw new MarketError("market is cancelled", "CANCELLED");

  const now = new Date();
  if (now < new Date(market.resolution_timestamp)) {
    throw new MarketError("resolution timestamp not reached yet", "TOO_EARLY");
  }

  const yesPool = toBigInt(market.yes_pool);
  const noPool = toBigInt(market.no_pool);

  if (yesPool === 0n || noPool === 0n) {
    await cancelMarket(marketId, "empty_side_pool");
    return;
  }

  let observation;
  try {
    const { resolver, feedId } = getResolver(market.oracle_source);
    observation = await resolver.verifyAndResolve(feedId);
  } catch (err) {
    throw new MarketError((err as Error).message, "UNSUPPORTED_ORACLE");
  }

  const windowEnd = new Date(
    new Date(market.resolution_timestamp).getTime() + market.resolution_window_sec * 1000
  );
  if (observation.observedAt < new Date(market.resolution_timestamp) || observation.observedAt > windowEnd) {
    throw new MarketError("oracle observation outside resolution window", "OUTSIDE_WINDOW");
  }
  if (!(observation.price > 0)) {
    throw new MarketError("invalid oracle price", "INVALID_PRICE");
  }

  const yesWon = evaluateComparison(market.comparison, observation.price, Number(market.strike_price));

  let settlement;
  try {
    settlement = settlePools(yesPool, noPool, yesWon, market.protocol_fee_bps);
  } catch {
    await cancelMarket(marketId, "zero_pool_at_settlement");
    return;
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE markets SET
        status = 'resolved',
        yes_won = $2,
        resolved_price = $3,
        resolved_at = now(),
        report_timestamp = $4,
        protocol_fee = $5,
        net_losing_pool = $6,
        reward_per_winning_share = $7
      WHERE id = $1`,
      [
        marketId,
        yesWon,
        observation.price,
        observation.observedAt,
        settlement.protocolFee.toString(),
        settlement.netLosingPool.toString(),
        settlement.rewardPerWinningShare.toString(),
      ]
    );

    await client.query(`UPDATE fee_treasury SET cumulative_fee = cumulative_fee + $1 WHERE id = 1`, [
      settlement.protocolFee.toString(),
    ]);

    await logEvent(client, marketId, "MarketResolved", {
      yesWon,
      resolvedPrice: observation.price,
      winningPool: settlement.winningPool.toString(),
      losingPool: settlement.losingPool.toString(),
      protocolFee: settlement.protocolFee.toString(),
    });
  });
}

/** Winner claim — stake + pro-rata share of the net losing pool (brief §30/§31). */
export async function claimPayout(marketId: string, address: string): Promise<bigint> {
  await ensureSchema();
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
    const market = rows[0];
    if (!market) throw new MarketError("market not found", "NOT_FOUND");
    if (market.status !== "resolved") throw new MarketError("market not resolved", "NOT_RESOLVED");

    const posRows = await client.query(
      `SELECT * FROM positions WHERE market_id = $1 AND address = $2 FOR UPDATE`,
      [marketId, address]
    );
    const position = posRows.rows[0];
    if (!position) throw new MarketError("no position for this address", "NO_POSITION");
    if (position.payout_claimed) throw new MarketError("already claimed", "ALREADY_CLAIMED");

    const winnerStake = market.yes_won ? toBigInt(position.yes_stake) : toBigInt(position.no_stake);
    const { totalPayout } = winnerPayout(winnerStake, toBigInt(market.reward_per_winning_share));

    await client.query(`UPDATE positions SET payout_claimed = true WHERE market_id = $1 AND address = $2`, [
      marketId,
      address,
    ]);

    if (totalPayout > 0n) {
      await client.query(`UPDATE wallets SET virtual_balance = virtual_balance + $2 WHERE address = $1`, [
        address,
        totalPayout.toString(),
      ]);
    }

    await logEvent(client, marketId, "PayoutClaimed", { address, amount: totalPayout.toString() });
    return totalPayout;
  });
}

/**
 * PAPER claim for a net-loss wallet — brief §11/§12/§15/§17. Computes net
 * realized loss (not gross losing stake), applies the piecewise emission
 * curve against the GLOBAL cumulative loss counter, and mints PAPER into
 * the ledger. Zero loss (including a hedged wallet that broke even or
 * profited) mints zero, per brief §53.
 */
export async function claimLossReward(marketId: string, address: string): Promise<{ realizedLoss: bigint; paperMinted: bigint }> {
  await ensureSchema();
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
    const market = rows[0];
    if (!market) throw new MarketError("market not found", "NOT_FOUND");
    if (market.status !== "resolved") throw new MarketError("market not resolved", "NOT_RESOLVED");

    const posRows = await client.query(
      `SELECT * FROM positions WHERE market_id = $1 AND address = $2 FOR UPDATE`,
      [marketId, address]
    );
    const position = posRows.rows[0];
    if (!position) throw new MarketError("no position for this address", "NO_POSITION");
    if (position.loss_reward_claimed) throw new MarketError("already claimed", "ALREADY_CLAIMED");

    const { realizedLoss } = calcNetLoss({
      yesStake: toBigInt(position.yes_stake),
      noStake: toBigInt(position.no_stake),
      yesWon: market.yes_won,
      rewardPerWinningShare: toBigInt(market.reward_per_winning_share),
    });

    const emissionRows = await client.query(`SELECT * FROM emission_state WHERE id = 1 FOR UPDATE`);
    const emissionState = emissionRows.rows[0];
    const cumulativeBefore = toBigInt(emissionState.cumulative_realized_loss);

    const paperMinted = realizedLoss > 0n ? calcEmission(cumulativeBefore, realizedLoss) : 0n;

    await client.query(
      `UPDATE positions SET loss_reward_claimed = true, realized_loss = $3, paper_minted = $4
       WHERE market_id = $1 AND address = $2`,
      [marketId, address, realizedLoss.toString(), paperMinted.toString()]
    );

    if (realizedLoss > 0n) {
      await client.query(
        `UPDATE emission_state SET
          cumulative_realized_loss = cumulative_realized_loss + $1,
          cumulative_paper_minted = cumulative_paper_minted + $2
        WHERE id = 1`,
        [realizedLoss.toString(), paperMinted.toString()]
      );
      await maybeEnableTransfers(client);
    }

    if (paperMinted > 0n) {
      await ensureWallet(client, address);
      await client.query(
        `INSERT INTO paper_ledger (address, balance, total_minted)
         VALUES ($1, $2, $2)
         ON CONFLICT (address) DO UPDATE SET
           balance = paper_ledger.balance + EXCLUDED.balance,
           total_minted = paper_ledger.total_minted + EXCLUDED.total_minted`,
        [address, paperMinted.toString()]
      );
    }

    await logEvent(client, marketId, "LossRewardClaimed", {
      address,
      realizedLoss: realizedLoss.toString(),
      paperMinted: paperMinted.toString(),
    });

    return { realizedLoss, paperMinted };
  });
}
