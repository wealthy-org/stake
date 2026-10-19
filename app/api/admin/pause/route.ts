import { NextRequest } from "next/server";
import { requireAdmin, isPaused, setPaused } from "@/lib/engine/admin";
import { ok, fail } from "@/lib/http";

// Brief §38 — pause blocks new bets and new market creation, never claims.
export async function GET() {
  try {
    return ok({ paused: await isPaused() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    await setPaused(Boolean(body.paused));
    return ok({ paused: Boolean(body.paused) });
  } catch (err) {
    return fail(err);
  }
}
