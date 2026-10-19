import { NextRequest } from "next/server";
import { placeBet } from "@/lib/engine/market";
import { ok, fail } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.side !== "yes" && body.side !== "no") {
      throw Object.assign(new Error("side must be 'yes' or 'no'"), { code: "INVALID_SIDE" });
    }
    await placeBet({
      marketId: id,
      address: String(body.address).toLowerCase(),
      side: body.side,
      amount: BigInt(body.amount),
    });
    return ok({ status: "placed" });
  } catch (err) {
    return fail(err);
  }
}
