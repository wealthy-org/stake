import { query } from "../db/client";
import { ensureSchema } from "../db/schema";
import { placeBet, faucetTopUp } from "./market";
import { toBaseUnits, COLLATERAL_DECIMALS } from "./units";

/**
 * Notional bot bettors — keep the board liquid while real testnet traffic
 * is thin. Bots are plain wallets going through the canonical placeBet flow
 * (same pool math, same BetPlaced event log as humans). The `tilt` skews each
 * bot's side choice: reversion bots pull lopsided odds back, bandwagon bots
 * stretch them. Funded virtually; all amounts converted from USD numbers.
 */

const BOT_WALLETS: { address: string; min: number; max: number; tilt: number }[] = [
  { address: "0x11c3d5f2a5f03e04b7c9a1d0c01f0f7a2c3de001", min: 4, max: 40, tilt: 0 },
  { address: "0x22d8b9317c04e81a5cb1e2d3b04c9e7f5a6bf002", min: 3, max: 25, tilt: -0.15 },
  { address: "0x33f4e07da2b6c49f6e35a0b9c07d3e2a4b6cf003", min: 10, max: 120, tilt: 0.1 },
  { address: "0x44a2c69b4e18d73b1f5c8e0a7d2b9f4c3e5af004", min: 2, max: 18, tilt: -0.05 },
  { address: "0x55e9d1a83b7f4c269d3a5c0e8b1f2d4a0c7be005", min: 5, max: 60, tilt: 0.05 },
  { address: "0x66b5f0c42d9a8e31f7b4c2d98a0e1f3b5d8cc006", min: 3, max: 30, tilt: 0 },
  { address: "0x77c6e2b9f4a1c5d83b2e7f0a6c4d9e1b3f5da007", min: 8, max: 90, tilt: -0.1 },
  { address: "0x88d7f3c0e5b2d9a64c1b3e8f5a2c6d0e4f7eb008", min: 2, max: 22, tilt: 0.05 },
  { address: "0x99e8a4d1f6c9e3b57a0d4b9f2c5e7a1d6b8fc009", min: 6, max: 75, tilt: 0.12 },
  { address: "0xaaf9b5e2c7f0d4c68b3f5d8a2e9b4c0f7d6ed00a", min: 4, max: 50, tilt: -0.12 },
];

const BOT_FUND_USD = 5_000;
const REFUND_EARLY_USD = 500; // top-up threshold — keep bots solvent forever
const SAME_MARKET_COOLDOWN = "interval '5 minutes'";
const MAX_ACTION_PER_TICK = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Side bias by current YES share: lopsided markets attract counter-bets.
 * `tilt` shifts the probability toward bandwagon or reversion per-bot persona.
 */
function chooseSide(yesPct: number, tilt: number): "yes" | "no" {
  let p = 0.5;
  if (yesPct >= 70) p = 0.24;
  else if (yesPct >= 55) p = 0.4;
  else if (yesPct > 45) p = 0.5;
  else if (yesPct > 30) p = 0.62;
  else p = 0.78;
  p = Math.min(0.95, Math.max(0.05, p + tilt));
  return Math.random() < p ? "yes" : "no";
}

async function ensureBotFunds(address: string): Promise<void> {
  const rows = await query<{ virtual_balance: string }>(
    `SELECT virtual_balance FROM wallets WHERE address = $1`,
    [address]
  );
  const balance = Number(rows[0]?.virtual_balance ?? 0);
  if (balance < toBaseUnits(REFUND_EARLY_USD, COLLATERAL_DECIMALS)) {
    await faucetTopUp(address, toBaseUnits(BOT_FUND_USD, COLLATERAL_DECIMALS));
  }
}

export async function runBotTick(): Promise<number> {
  await ensureSchema();

  const markets = await query<{
    id: string;
    min_bet: string;
    max_bet: string;
    yes_pool: string;
    no_pool: string;
  }>(
    `SELECT id, min_bet, max_bet, yes_pool, no_pool FROM markets
     WHERE status = 'open' AND betting_closes_at > now()
     ORDER BY random() LIMIT 12`
  );
  if (markets.length === 0) return 0;

  const acting = BOT_WALLETS.filter(() => Math.random() < 0.05).slice(0, MAX_ACTION_PER_TICK);
  let acted = 0;

  for (const bot of acting) {
    const market = markets[Math.floor(Math.random() * markets.length)];

    // Rate limit: no bot repeats on the same market within the cooldown.
    const recent = await query(
      `SELECT 1 AS ok FROM bets WHERE market_id = $1 AND address = $2
       AND created_at > now() - ${SAME_MARKET_COOLDOWN} LIMIT 1`,
      [market.id, bot.address]
    );
    if (recent.length > 0) continue;

    const yes = Number(market.yes_pool || 0);
    const no = Number(market.no_pool || 0);
    const total = yes + no;
    const yesPct = total > 0 ? (yes / total) * 100 : 50;

    const side = chooseSide(yesPct, bot.tilt);
    const wantUsd = Math.round(bot.min + Math.random() * (bot.max - bot.min));
    const minUsd = Math.max(1, Math.round(Number(market.min_bet) / 1e6));
    const maxUsd = Math.max(minUsd, Math.round(Number(market.max_bet) / 1e6));
    const amountUsd = Math.min(Math.max(wantUsd, minUsd), Math.min(maxUsd, 5_000));

    await ensureBotFunds(bot.address).catch(() => {});
    try {
      await placeBet({
        marketId: market.id,
        address: bot.address,
        side,
        amount: toBaseUnits(amountUsd, COLLATERAL_DECIMALS),
      });
      acted += 1;
    } catch {
      // skipped silently (cooldown race, bounds) — next tick picks someone else
    }
    await sleep(500 + Math.random() * 3_500);
  }
  return acted;
}
