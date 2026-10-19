import { queryOne, query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { ok, fail, toJsonSafe } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const market = await queryOne(`SELECT * FROM markets WHERE id = $1`, [id]);
    if (!market) return fail(Object.assign(new Error("not_found"), { code: "NOT_FOUND" }));
    const positions = await query(`SELECT * FROM positions WHERE market_id = $1`, [id]);
    const bets = await query(`SELECT * FROM bets WHERE market_id = $1 ORDER BY created_at ASC`, [id]);
    return ok(toJsonSafe({ market, positions, bets }));
  } catch (err) {
    return fail(err);
  }
}
