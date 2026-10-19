import { queryOne, query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { ok, fail, toJsonSafe } from "@/lib/http";

// User position history + claimable state (brief §41 /portfolio backing data).
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    await ensureSchema();
    const { address } = await params;
    const addr = address.toLowerCase();

    const wallet = await queryOne(`SELECT * FROM wallets WHERE address = $1`, [addr]);
    const paper = await queryOne(`SELECT * FROM paper_ledger WHERE address = $1`, [addr]);
    const positions = await query(
      `SELECT p.*, m.question, m.status, m.yes_won
       FROM positions p JOIN markets m ON m.id = p.market_id
       WHERE p.address = $1 ORDER BY m.created_at DESC`,
      [addr]
    );

    return ok(
      toJsonSafe({
        address: addr,
        virtualBalance: wallet?.virtual_balance ?? "0",
        paperBalance: paper?.balance ?? "0",
        paperTotalMinted: paper?.total_minted ?? "0",
        positions,
      })
    );
  } catch (err) {
    return fail(err);
  }
}
