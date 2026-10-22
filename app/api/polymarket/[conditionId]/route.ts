import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";

const GAMMA_BASE = process.env.POLYMARKET_API_BASE ?? "https://gamma-api.polymarket.com";

/**
 * Live enrichment for a Polymarket-sourced market's detail page: the
 * current real Polymarket odds, volume, liquidity, and a link back to the
 * original market — everything our own DB row doesn't store, fetched
 * fresh rather than baked in at auto-generation time so it stays
 * accurate as the real market keeps trading.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ conditionId: string }> }) {
  try {
    const { conditionId } = await params;
    const res = await fetch(`${GAMMA_BASE}/markets?condition_ids=${encodeURIComponent(conditionId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Polymarket lookup failed: ${res.status}`);
    const rows = (await res.json()) as any[];
    const m = rows[0];
    if (!m) throw new Error("market not found on Polymarket");

    const outcomes = JSON.parse(m.outcomes ?? "[]") as string[];
    const outcomePrices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(Number);

    return ok({
      question: m.question,
      slug: m.slug,
      image: m.image ?? null,
      description: m.description ?? null,
      active: Boolean(m.active),
      closed: Boolean(m.closed),
      yesPrice: outcomes[0] === "Yes" ? outcomePrices[0] : null,
      noPrice: outcomes[1] === "No" ? outcomePrices[1] : null,
      volume: Number(m.volume ?? 0),
      volume24hr: Number(m.volume24hr ?? 0),
      liquidity: Number(m.liquidity ?? 0),
      endDate: m.endDate ?? null,
      polymarketUrl: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
      // Real order-book pricing and the resolution source Polymarket itself
      // cites, on top of the single pooled-odds number we already had —
      // enrichment the leader asked for, scoped to what fits this panel
      // without turning it into a dump of every Gamma field.
      bestBid: m.bestBid != null ? Number(m.bestBid) : null,
      bestAsk: m.bestAsk != null ? Number(m.bestAsk) : null,
      spread: m.spread != null ? Number(m.spread) : null,
      oneDayPriceChange: m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : null,
      resolutionSource: m.resolutionSource || null,
    });
  } catch (err) {
    return fail(Object.assign(new Error((err as Error).message || "polymarket lookup failed"), { code: "POLYMARKET_UNAVAILABLE" }));
  }
}
