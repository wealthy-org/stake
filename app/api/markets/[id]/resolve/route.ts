import { resolveMarket } from "@/lib/engine/market";
import { ok, fail } from "@/lib/http";

// Manual resolution trigger — brief §28: permissionless resolution, anyone with
// a valid report can call this. The worker also calls resolveMarket automatically
// once resolution_timestamp passes; this route exists for testing/forcing it now.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await resolveMarket(id);
    return ok({ status: "resolved" });
  } catch (err) {
    return fail(err);
  }
}
