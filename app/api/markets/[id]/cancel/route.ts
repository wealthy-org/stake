import { NextRequest } from "next/server";
import { cancelMarket } from "@/lib/engine/market";
import { requireAdmin } from "@/lib/engine/admin";
import { ok, fail } from "@/lib/http";

// Brief §29 — emergency cancellation, restricted to an admin key (brief §37
// says admin may pause/manage, but never override a finalized outcome —
// cancelMarket itself still refuses to touch a resolved market).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await cancelMarket(id, body.reason ?? "manual_cancel");
    return ok({ status: "cancelled" });
  } catch (err) {
    return fail(err);
  }
}
