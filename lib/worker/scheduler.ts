import { query } from "../db/client";
import { openDueMarkets, lockDueMarkets, resolveMarket, cancelMarket } from "../engine/market";
import { ensureAutoMarkets } from "../engine/autoMarket";
import { runBotTick } from "../engine/bots";

const TICK_INTERVAL_MS = 15_000;
let started = false;
let tickInFlight = false;

// Temporarily off: Polymarket open/close timing means a real new market
// can take days to appear, which is too slow to iterate on while testing.
// Kept in place (not deleted) — flip back to true once auto-creation from
// live Polymarket data should resume, or call ensureAutoMarkets()
// manually/from an admin action in the meantime.
const AUTO_CREATE_MARKETS = false;

async function tick(): Promise<void> {
  // Guard against overlapping ticks: if one tick runs longer than the
  // 15s interval (easy to happen once ensureAutoMarkets' per-asset
  // advisory locks start queuing), setInterval fires again regardless —
  // without this, a second tick starts on top of the first, both racing
  // for the same locks via pg_advisory_xact_lock. The lock itself can't
  // deadlock anymore, but the second tick just blocks and piles up as an
  // "idle in transaction" connection, and repeated overlaps exhaust the
  // whole pool exactly like that.
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await tickOnce();
  } finally {
    tickInFlight = false;
  }
}

async function tickOnce(): Promise<void> {
  try {
    await openDueMarkets();
    await lockDueMarkets();

    const due = await query<{ id: string; resolution_timestamp: string; resolution_window_sec: number }>(
      `SELECT id, resolution_timestamp, resolution_window_sec FROM markets
       WHERE status = 'locked' AND resolution_timestamp <= now()`
    );

    for (const market of due) {
      const windowEnd = new Date(
        new Date(market.resolution_timestamp).getTime() + market.resolution_window_sec * 1000
      );
      try {
        await resolveMarket(market.id);
      } catch (err) {
        // Brief §29 — if no valid report lands within the grace window, cancel instead of hanging forever.
        if (new Date() > windowEnd) {
          await cancelMarket(market.id, "no_valid_report_in_window").catch(() => {});
        } else {
          console.error(`[worker] resolve attempt failed for ${market.id} (will retry):`, (err as Error).message);
        }
      }
    }

    // Keeps the board non-empty with zero admin action — see lib/engine/autoMarket.ts.
    if (AUTO_CREATE_MARKETS) await ensureAutoMarkets();

    // Notional bettors keep volumes moving — see lib/engine/bots.ts.
    await runBotTick().catch((err) => console.error("[worker] bot tick failed:", err));
  } catch (err) {
    console.error("[worker] tick failed:", err);
  }
}

/**
 * Call only after the caller has already ensured the schema exists (see
 * lib/db/schema.ts). Deliberately does NOT run a tick synchronously here —
 * tick() calls engine functions that themselves call ensureSchema(), and
 * this function is invoked from inside ensureSchema()'s own promise chain,
 * so an immediate await here would deadlock on itself. The first tick runs
 * on the interval instead, by which point ensureSchema() has resolved.
 *
 * Local-dev-only convenience: a real Vercel deployment runs on serverless
 * instances with no long-lived process to hold a setInterval, and worse,
 * EVERY concurrently invoked instance would start its own interval if we
 * let this run there — exactly what caused the per-asset advisory locks
 * to keep piling up under load (tickInFlight only guards one process, not
 * many). In production, GET /api/cron/tick on a real Vercel Cron schedule
 * is the sole trigger instead, so there is ever only one tick in flight
 * for the whole deployment, not one per instance.
 */
export async function startWorker(): Promise<void> {
  if (started) return;
  if (process.env.VERCEL) {
    console.log("[worker] on Vercel — ticking happens via the /api/cron/tick schedule, not setInterval");
    return;
  }
  started = true;
  console.log("[worker] paper-bet resolution worker started (local dev interval)");
  setInterval(tick, TICK_INTERVAL_MS);
}

/** Entry point for the Vercel Cron route — reuses the same overlap guard as the local-dev interval. */
export async function runScheduledTick(): Promise<void> {
  await tick();
}
