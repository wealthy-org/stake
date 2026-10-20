import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getBinanceHistory, getNasdaqHistory, isTimeframe, type PricePoint } from "@/lib/oracle/history";

/**
 * Public price history for the market detail chart. No DB involved —
 * proxies real market data (Binance klines for crypto, Nasdaq chart for
 * Stock Tokens). Returns 404-ish MarketError codes so the client can fall
 * back to its illustrative series.
 */
export async function GET(req: NextRequest) {
  try {
    const feed = req.nextUrl.searchParams.get("feed") ?? "";
    const source = req.nextUrl.searchParams.get("source") ?? "binance";
    const tfParam = req.nextUrl.searchParams.get("tf") ?? "7D";
    const tf = isTimeframe(tfParam) ? tfParam : "7D";
    if (!feed) return fail(Object.assign(new Error("feed is required"), { code: "INVALID_INPUT" }));

    let points: PricePoint[];
    if (source === "stock") {
      points = await getNasdaqHistory(feed);
    } else {
      points = await getBinanceHistory(feed, tf);
    }
    return ok(points);
  } catch (err) {
    return fail(Object.assign(new Error((err as Error).message || "history unavailable"), { code: "HISTORY_UNAVAILABLE" }));
  }
}
