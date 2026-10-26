import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getBinanceHistory, getNasdaqHistory, getPolymarketHistory, isTimeframe, type PricePoint } from "@/lib/oracle/history";

// Binance blocks requests from US-region cloud IPs (HTTP 451, "restricted
// location"). `preferredRegion` alone doesn't fix this for a Node.js
// serverless function on Vercel's Hobby plan — it's only a routing hint;
// the function itself still executes in the project's single home region
// (iad1, US), confirmed via the `x-vercel-id: sin1::iad1::...` response
// header. Edge Runtime is the one Vercel feature that actually executes in
// the requested region on every plan, so switch to it instead.
export const runtime = "edge";
export const preferredRegion = "sin1";

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
    } else if (source === "polymarket") {
      points = await getPolymarketHistory(feed, tf);
    } else {
      points = await getBinanceHistory(feed, tf);
    }
    return Response.json(points, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return fail(Object.assign(new Error((err as Error).message || "history unavailable"), { code: "HISTORY_UNAVAILABLE" }));
  }
}

