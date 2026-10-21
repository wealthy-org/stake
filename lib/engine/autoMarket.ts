import { getPool, query } from "../db/client";
import { binanceResolver } from "../oracle/binance";
import { stockOracleResolver } from "../oracle/stock";
import { createMarket } from "./market";
import { toBaseUnits } from "./units";

/**
 * Keeps the board non-empty without any admin action. Called from the
 * worker tick (lib/worker/scheduler.ts) — createMarket() here is the
 * engine-level function, which has no admin-key gate; only the
 * POST /api/markets route does. So this runs fully automatically.
 *
 * Brief §6 limits V1 to deterministic price questions; this generator
 * rolls a ladder of them — every asset gets a "tomorrow" market and a
 * "this week" market (stock tokens get one of each on NVDA, plus 24h
 * rolls on AAPL/TSLA/GOOGL), some seeded above the strike and some
 * below. Strike price derives from the LIVE oracle price at creation
 * time, rounded to a clean number so the question reads naturally.
 *
 * Uniqueness is per (asset, horizon-band): an existing active market
 * whose betting_closes_at lands inside the band covers the slot, so a
 * 24h market never blocks the weekly one. A small per-asset cap is the
 * catch-up safety valve so one empty board can't spawn unbounded rows.
 * Durations, fee, and bounds remain testnet-only defaults (brief §75).
 */
interface AutoMarketConfig {
  assetSymbol: string;
  source: "binance" | "stock";
  feedSymbol: string;
  roundTo: number;
  openForHours: number;
  direction: "above" | "below";
  bandHours: number;
}

const AUTO_MARKETS: AutoMarketConfig[] = [
  { assetSymbol: "ETH", source: "binance", feedSymbol: "ETHUSDT", roundTo: 50, openForHours: 24, direction: "above", bandHours: 6 },
  { assetSymbol: "ETH", source: "binance", feedSymbol: "ETHUSDT", roundTo: 50, openForHours: 168, direction: "above", bandHours: 12 },
  { assetSymbol: "BTC", source: "binance", feedSymbol: "BTCUSDT", roundTo: 1000, openForHours: 24, direction: "below", bandHours: 6 },
  { assetSymbol: "BTC", source: "binance", feedSymbol: "BTCUSDT", roundTo: 1000, openForHours: 168, direction: "above", bandHours: 12 },
  { assetSymbol: "SOL", source: "binance", feedSymbol: "SOLUSDT", roundTo: 5, openForHours: 24, direction: "above", bandHours: 6 },
  { assetSymbol: "SOL", source: "binance", feedSymbol: "SOLUSDT", roundTo: 5, openForHours: 168, direction: "below", bandHours: 12 },
  { assetSymbol: "NVDA", source: "stock", feedSymbol: "NVDA", roundTo: 10, openForHours: 24, direction: "above", bandHours: 6 },
  { assetSymbol: "NVDA", source: "stock", feedSymbol: "NVDA", roundTo: 10, openForHours: 168, direction: "above", bandHours: 12 },
  { assetSymbol: "AAPL", source: "stock", feedSymbol: "AAPL", roundTo: 5, openForHours: 24, direction: "above", bandHours: 6 },
  { assetSymbol: "TSLA", source: "stock", feedSymbol: "TSLA", roundTo: 10, openForHours: 24, direction: "above", bandHours: 6 },
  { assetSymbol: "TSLA", source: "stock", feedSymbol: "TSLA", roundTo: 10, openForHours: 168, direction: "above", bandHours: 12 },
  { assetSymbol: "GOOGL", source: "stock", feedSymbol: "GOOGL", roundTo: 5, openForHours: 24, direction: "above", bandHours: 6 },
];

const MAX_ACTIVE_PER_ASSET = 3;
const ACTIVE_STATUSES = ["draft", "open", "locked", "resolution_pending"];

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

async function countActiveForAsset(assetSymbol: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets WHERE asset_symbol = $1 AND status = ANY($2)`,
    [assetSymbol, ACTIVE_STATUSES]
  );
  return Number(rows[0].count);
}

/** True when an active market for the asset already closes inside this horizon band. */
async function hasMarketEndingNear(assetSymbol: string, closeLowMs: number, closeHighMs: number): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets
     WHERE asset_symbol = $1 AND status = ANY($2)
       AND betting_closes_at >= $3 AND betting_closes_at <= $4`,
    [assetSymbol, ACTIVE_STATUSES, new Date(closeLowMs), new Date(closeHighMs)]
  );
  return Number(rows[0].count) > 0;
}

async function getSpotPrice(config: AutoMarketConfig): Promise<number> {
  if (config.source === "stock") {
    const obs = await stockOracleResolver.getStockObservation(config.feedSymbol);
    if (obs.isHalted) throw new Error(`${config.feedSymbol} trading halted`);
    return obs.price;
  }
  const observation = await binanceResolver.verifyAndResolve(config.feedSymbol);
  return observation.price;
}

export async function ensureAutoMarkets(): Promise<string[]> {
  const created: string[] = [];
  const now = Date.now();

  // Group per asset so the per-asset cap is enforced once (not per slot).
  const byAsset = new Map<string, AutoMarketConfig[]>();
  for (const config of AUTO_MARKETS) {
    const list = byAsset.get(config.assetSymbol) ?? [];
    list.push(config);
    byAsset.set(config.assetSymbol, list);
  }

  for (const [assetSymbol, configs] of byAsset) {
    // Multiple serverless instances can each run their own worker tick
    // concurrently (no single long-lived process on Vercel), so a plain
    // check-then-insert races: several instances see "no market yet" for
    // the same slot at once and all create an identical duplicate.
    //
    // A session-scoped pg_advisory_lock/unlock pair looked like the fix,
    // but it isn't: if two ticks ever acquire per-asset locks in a
    // different order, Postgres detects the deadlock and kills one side
    // mid-flight, before its unlock statement runs. That connection then
    // goes back to the pool still holding the lock forever — the next
    // request to touch that asset hangs until the client-side timeout,
    // every single time, since nothing ever unlocks it again.
    //
    // pg_advisory_xact_lock has no such failure mode: it's released the
    // instant this transaction ends, via COMMIT or ROLLBACK, no matter
    // how we get there — including the deadlock killer itself, which acts
    // like an automatic ROLLBACK. There is no code path that leaks it.
    const lockClient = await getPool().connect();
    let brokenConnection = false;
    try {
      await lockClient.query("BEGIN");
      try {
        await lockClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [assetSymbol]);

        if (!((await countActiveForAsset(assetSymbol)) >= MAX_ACTIVE_PER_ASSET)) {
          let spot: number | null = null;

          for (const config of configs) {
            try {
              const closeLow = now + (config.openForHours - config.bandHours) * 3_600_000;
              const closeHigh = now + (config.openForHours + config.bandHours) * 3_600_000;
              if (await hasMarketEndingNear(assetSymbol, closeLow, closeHigh)) continue;

              if (spot === null) spot = await getSpotPrice(config);
              const strike = roundToNearest(spot, config.roundTo);
              if (strike <= 0) continue;

              const bettingClosesAt = new Date(now + config.openForHours * 3_600_000);
              const resolutionTimestamp = new Date(bettingClosesAt.getTime() + 5 * 60_000);
              const word = config.direction === "above" ? "above" : "below";

              const id = await createMarket({
                question: `Will ${assetSymbol} be ${word} $${strike.toLocaleString("en-US")} at ${resolutionTimestamp.toUTCString()}?`,
                assetSymbol,
                oracleSource: `${config.source}:${config.feedSymbol}`,
                strikePrice: strike,
                comparison: config.direction === "above" ? "gt" : "lt",
                bettingOpensAt: new Date(now),
                bettingClosesAt,
                resolutionTimestamp,
                resolutionWindowSec: 300,
                protocolFeeBps: 200,
                minBet: toBaseUnits(1, 6),
                maxBet: toBaseUnits(5_000, 6),
              });

              created.push(id);
            } catch (err) {
              console.error(`[autoMarket] slot failed for ${assetSymbol} ${config.openForHours}h:`, (err as Error).message);
            }
          }
        }

        await lockClient.query("COMMIT");
      } catch (err) {
        brokenConnection = true;
        await lockClient.query("ROLLBACK").catch(() => {});
        console.error(`[autoMarket] failed for ${assetSymbol}:`, (err as Error).message);
      }
    } finally {
      // On any failure, destroy this connection instead of returning it to
      // the pool — belt-and-suspenders against a wedged transaction ever
      // being handed to the next caller.
      lockClient.release(brokenConnection);
    }
  }

  return created;
}
