import { NextRequest } from "next/server";
import { claimLossReward } from "@/lib/engine/market";
import { ok, fail, toJsonSafe } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await claimLossReward(id, String(body.address).toLowerCase());
    return ok(toJsonSafe(result));
  } catch (err) {
    return fail(err);
  }
}
