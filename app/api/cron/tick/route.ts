import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/schema";
import { runScheduledTick } from "@/lib/worker/scheduler";

/**
 * The single source of worker ticks in production (see vercel.json's
 * crons entry). Replaces the old per-instance setInterval, which spun up
 * one independent interval per serverless instance that happened to get
 * invoked — the root cause of the repeated advisory-lock pileups. Vercel
 * guarantees only one cron invocation runs at a time for a given
 * schedule, so there is no overlap to guard against beyond what tick()
 * already does for local dev.
 */
export async function GET(req: NextRequest) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron-triggered
  // requests when CRON_SECRET is set — reject anything else so this route
  // can't be used by the public to force extra ticks.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  await ensureSchema();
  await runScheduledTick();
  return NextResponse.json({ ok: true });
}
