import { queryOne } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { isPaused } from "@/lib/engine/admin";
import { ok, fail, toJsonSafe } from "@/lib/http";

// Brief §36 — transparent fee treasury snapshot. No withdrawal endpoint:
// there is no real treasury wallet to withdraw to yet in this phase.
export async function GET() {
  try {
    await ensureSchema();
    const treasury = await queryOne<{ cumulative_fee: string }>(`SELECT cumulative_fee FROM fee_treasury WHERE id = 1`);
    return ok(toJsonSafe({ cumulativeFee: treasury?.cumulative_fee ?? "0", paused: await isPaused() }));
  } catch (err) {
    return fail(err);
  }
}
