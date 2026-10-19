import { query } from "../db/client";
import { binanceResolver } from "../oracle/binance";
import { createMarket } from "./market";
import { toBaseUnits } from "./units";

/**
 * Keeps the board non-empty without any admin action. Called from the
 * worker tick (lib/worker/scheduler.ts) — createMarket() here is the
 * engine-level function, which has no admin-key gate; only the
 * POST /api/markets route does. So this runs fully automatically.
 *
 * Strike price is derived from a LIVE Binance spot price at creation time
 * (the same oracle source used for resolution), rounded to a clean number
 * so the question reads naturally ("above $3,850", not "above $3,842.17").
 * Everything else (duration, fee, bet bounds) is a testnet-only default —
 * brief §75 still has these as open product decisions.
 */
interface AutoMarketConfig {
  assetSymbol: string;
  binanceSymbol: string;
  roundTo: number; // round the live price to the nearest multiple of this
  openForHours: number;
}

const AUTO_MARKETS: AutoMarketConfig[] = [
  { assetSymbol: "ETH", binanceSymbol: "ETHUSDT", roundTo: 50, openForHours: 24 },
  { assetSymbol: "BTC", binanceSymbol: "BTCUSDT", roundTo: 1000, openForHours: 24 },
  { assetSymbol: "SOL", binanceSymbol: "SOLUSDT", roundTo: 5, openForHours: 24 },
];

const ACTIVE_STATUSES = ["draft", "open", "locked", "resolution_pending"];

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

async function hasActiveMarket(assetSymbol: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets WHERE asset_symbol = $1 AND status = ANY($2)`,
    [assetSymbol, ACTIVE_STATUSES]
  );
  return Number(rows[0].count) > 0;
}

export async function ensureAutoMarkets(): Promise<string[]> {
  const created: string[] = [];

  for (const config of AUTO_MARKETS) {
    try {
      if (await hasActiveMarket(config.assetSymbol)) continue;

      const observation = await binanceResolver.verifyAndResolve(config.binanceSymbol);
      const strike = roundToNearest(observation.price, config.roundTo);

      const now = new Date();
      const bettingClosesAt = new Date(now.getTime() + config.openForHours * 3_600_000);
      const resolutionTimestamp = new Date(bettingClosesAt.getTime() + 5 * 60_000);

      const id = await createMarket({
        question: `Will ${config.assetSymbol} be above $${strike.toLocaleString("en-US")} at ${resolutionTimestamp.toUTCString()}?`,
        assetSymbol: config.assetSymbol,
        oracleSource: `binance:${config.binanceSymbol}`,
        strikePrice: strike,
        comparison: "gt",
        bettingOpensAt: now,
        bettingClosesAt,
        resolutionTimestamp,
        resolutionWindowSec: 300,
        protocolFeeBps: 200,
        minBet: toBaseUnits(1, 6),
        maxBet: toBaseUnits(5_000, 6),
      });

      created.push(id);
    } catch (err) {
      console.error(`[autoMarket] failed to auto-create a market for ${config.assetSymbol}:`, (err as Error).message);
    }
  }

  return created;
}
