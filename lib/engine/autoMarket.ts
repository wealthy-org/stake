import { getPool, query } from "../db/client";
import { fetchPolymarketMarkets, getYesTokenId, POLYMARKET_CATEGORIES, type PolymarketCategory } from "../oracle/polymarket";
import { createMarket } from "./market";
import { toBaseUnits } from "./units";

/**
 * Replaces the old price-threshold generator (Binance/Nasdaq strike
 * questions) entirely — leader decision: markets now come from real
 * Polymarket questions instead. Launch categories are Crypto, Finance,
 * Geopolitics and Tech; Politics/Sports/Esports/Iran are held back
 * deliberately, to be turned on later as a marketing/update moment, not
 * because of any technical limitation.
 *
 * Resolution mirrors Polymarket itself (lib/oracle/polymarket.ts) — our
 * market only resolves once Polymarket's own market has actually closed.
 * Everything else (bet/payout/claim, the per-category advisory lock
 * against concurrent serverless instances) is unchanged from before.
 */
const LAUNCH_CATEGORIES: PolymarketCategory[] = ["CRYPTO", "FINANCE", "GEOPOLITICS", "TECH"];

const MAX_ACTIVE_PER_CATEGORY = 5;
const ACTIVE_STATUSES = ["draft", "open", "locked", "resolution_pending"];

// Polymarket markets can have end dates years out — skip anything that far
// so the board stays made of questions people can actually wait out,
// without blocking a category's cap on stale long-horizon noise.
const MAX_HORIZON_DAYS = 90;

// UMA-based resolution on Polymarket's side can take time after a
// market's stated end date (disputes, etc.) — give resolveMarket() a
// generous grace window instead of the few-minutes window price markets
// used, so a slow-to-settle Polymarket market doesn't get cancelled here
// for "no valid report in window" before Polymarket has even closed it.
const RESOLUTION_WINDOW_SEC = 7 * 24 * 3600;

async function countActiveForCategory(category: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets WHERE asset_symbol = $1 AND status = ANY($2)`,
    [category, ACTIVE_STATUSES]
  );
  return Number(rows[0].count);
}

/** Matches by prefix (not exact equality) so a conditionId already tracked under the older 2-segment oracle_source format (before the Yes-token-id suffix was added) still counts as tracked. */
async function alreadyTrackedByCondition(conditionId: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets WHERE oracle_source LIKE $1`,
    [`polymarket:${conditionId}%`]
  );
  return Number(rows[0].count) > 0;
}

export async function ensureAutoMarkets(): Promise<string[]> {
  const created: string[] = [];
  const now = Date.now();
  const maxEndDate = now + MAX_HORIZON_DAYS * 24 * 3600_000;

  for (const category of LAUNCH_CATEGORIES) {
    // Same reasoning as before the Pons/RewardVault work: multiple
    // concurrent serverless instances can each try to fill the same
    // category's slots at once. pg_advisory_xact_lock serializes that
    // per category, and releases automatically on commit/rollback no
    // matter how this block exits — see the autoMarket git history for
    // the deadlock this replaced.
    const lockClient = await getPool().connect();
    let brokenConnection = false;
    try {
      await lockClient.query("BEGIN");
      try {
        await lockClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [category]);

        const activeCount = await countActiveForCategory(category);
        let createdForThisCategory = 0;
        if (activeCount < MAX_ACTIVE_PER_CATEGORY) {
          const polymarketMarkets = await fetchPolymarketMarkets(category, 20);

          for (const pm of polymarketMarkets) {
            if (createdForThisCategory + activeCount >= MAX_ACTIVE_PER_CATEGORY) break;

            const endDateMs = new Date(pm.endDate).getTime();
            if (!Number.isFinite(endDateMs) || endDateMs <= now || endDateMs > maxEndDate) continue;

            // Third segment (optional) is the Yes CLOB token id, carried
            // through purely so the dashboard's featured-market chart can
            // fetch real probability history — getResolver() only ever
            // reads the first two segments, so this is additive.
            const yesTokenId = getYesTokenId(pm);
            const oracleSource = yesTokenId
              ? `polymarket:${pm.conditionId}:${yesTokenId}`
              : `polymarket:${pm.conditionId}`;
            if (await alreadyTrackedByCondition(pm.conditionId)) continue;

            try {
              const bettingClosesAt = new Date(endDateMs);
              const resolutionTimestamp = bettingClosesAt;

              const id = await createMarket({
                question: pm.question,
                assetSymbol: category,
                oracleSource,
                strikePrice: 0.5,
                comparison: "gt",
                bettingOpensAt: new Date(now),
                bettingClosesAt,
                resolutionTimestamp,
                resolutionWindowSec: RESOLUTION_WINDOW_SEC,
                protocolFeeBps: 200,
                minBet: toBaseUnits(1, 6),
                maxBet: toBaseUnits(5_000, 6),
              });

              created.push(id);
              createdForThisCategory++;
            } catch (err) {
              console.error(`[autoMarket] slot failed for ${category} (${pm.conditionId}):`, (err as Error).message);
            }
          }
        }

        await lockClient.query("COMMIT");
      } catch (err) {
        brokenConnection = true;
        await lockClient.query("ROLLBACK").catch(() => {});
        console.error(`[autoMarket] failed for ${category}:`, (err as Error).message);
      }
    } finally {
      lockClient.release(brokenConnection);
    }
  }

  return created;
}

export { LAUNCH_CATEGORIES, POLYMARKET_CATEGORIES };
