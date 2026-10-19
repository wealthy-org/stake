import { NextRequest } from "next/server";
import { faucetTopUp } from "@/lib/engine/market";
import { ok, fail } from "@/lib/http";

// Virtual-balance faucet, standing in for a real deposit flow while there's
// no custody contract yet (brief §18/§65). Unauthenticated — local/testnet only.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = String(body.address).toLowerCase();
    const amount = BigInt(body.amount);
    await faucetTopUp(address, amount);
    return ok({ status: "topped_up" });
  } catch (err) {
    return fail(err);
  }
}
