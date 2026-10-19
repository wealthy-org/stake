import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { ok, fail, toJsonSafe } from "@/lib/http";

// Backing data for the brief §41 /activity feed — a readable tail of the events log.
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), 1000);
    const events = await query(
      `SELECT e.*, m.question
       FROM events e LEFT JOIN markets m ON m.id = e.market_id
       ORDER BY e.created_at DESC LIMIT $1`,
      [limit]
    );
    return ok(toJsonSafe(events));
  } catch (err) {
    return fail(err);
  }
}
