import { queryOne } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { ok, fail, toJsonSafe } from "@/lib/http";

// Global protocol stats — brief §42/§68 homepage + /stats backing data.
export async function GET() {
  try {
    await ensureSchema();

    const totals = await queryOne<any>(
      `SELECT
        COALESCE(SUM(amount), 0) AS total_wagered,
        COUNT(DISTINCT address) AS unique_bettors
       FROM bets`
    );
    const marketCounts = await queryOne<any>(
      `SELECT
        COUNT(*) AS total_markets,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_markets,
        COUNT(*) FILTER (WHERE status IN ('open','locked')) AS active_markets
       FROM markets`
    );
    const emission = await queryOne<any>(`SELECT * FROM emission_state WHERE id = 1`);
    const treasury = await queryOne<any>(`SELECT * FROM fee_treasury WHERE id = 1`);

    return ok(
      toJsonSafe({
        totalWagered: totals.total_wagered,
        uniqueBettors: Number(totals.unique_bettors),
        totalMarkets: Number(marketCounts.total_markets),
        resolvedMarkets: Number(marketCounts.resolved_markets),
        activeMarkets: Number(marketCounts.active_markets),
        realizedNetLosses: emission.cumulative_realized_loss,
        paperCreated: emission.cumulative_paper_minted,
        protocolFees: treasury.cumulative_fee,
      })
    );
  } catch (err) {
    return fail(err);
  }
}
