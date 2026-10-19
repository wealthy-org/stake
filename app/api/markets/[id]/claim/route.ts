import { NextRequest } from "next/server";
import { claimPayout, claimRefund } from "@/lib/engine/market";
import { queryOne } from "@/lib/db/client";
import { ok, fail, toJsonSafe } from "@/lib/http";

// Winner payout claim (resolved market) or refund claim (cancelled market) — brief §30.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const address = String(body.address).toLowerCase();

    const market = await queryOne<{ status: string }>(`SELECT status FROM markets WHERE id = $1`, [id]);
    if (!market) throw Object.assign(new Error("not_found"), { code: "NOT_FOUND" });

    const amount =
      market.status === "cancelled" ? await claimRefund(id, address) : await claimPayout(id, address);

    return ok(toJsonSafe({ amount }));
  } catch (err) {
    return fail(err);
  }
}
