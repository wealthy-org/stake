import { NextRequest } from "next/server";
import { openDueMarkets, lockDueMarkets, resolveMarket, cancelMarket } from "@/lib/engine/market";
import { ensureAutoMarkets } from "@/lib/engine/autoMarket";
import { query } from "@/lib/db/client";
import { ok, fail } from "@/lib/http";

// Manual worker-tick trigger for tests/scripts, instead of waiting for the
// in-process scheduler's 15s interval. Optionally gated by TICK_SECRET.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.TICK_SECRET;
    if (secret) {
      const header = req.headers.get("x-tick-secret");
      if (header !== secret) {
        return fail(Object.assign(new Error("unauthorized"), { code: "UNAUTHORIZED" }));
      }
    }

    const opened = await openDueMarkets();
    const locked = await lockDueMarkets();

    const due = await query<{ id: string; resolution_timestamp: string; resolution_window_sec: number }>(
      `SELECT id, resolution_timestamp, resolution_window_sec FROM markets
       WHERE status = 'locked' AND resolution_timestamp <= now()`
    );

    const resolved: string[] = [];
    const cancelled: string[] = [];
    for (const market of due) {
      const windowEnd = new Date(
        new Date(market.resolution_timestamp).getTime() + market.resolution_window_sec * 1000
      );
      try {
        await resolveMarket(market.id);
        resolved.push(market.id);
      } catch {
        if (new Date() > windowEnd) {
          await cancelMarket(market.id, "no_valid_report_in_window");
          cancelled.push(market.id);
        }
      }
    }

    const autoCreated = await ensureAutoMarkets();

    return ok({ opened, locked, resolved, cancelled, autoCreated });
  } catch (err) {
    return fail(err);
  }
}
