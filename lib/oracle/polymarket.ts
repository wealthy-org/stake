import type { IOracleResolver, PriceObservation } from "./resolver";

const GAMMA_BASE = process.env.POLYMARKET_API_BASE ?? "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string; // JSON-encoded string array, e.g. '["Yes","No"]'
  outcomePrices: string; // JSON-encoded string array, e.g. '["0.925","0.075"]'
  volume: string;
  volume24hr?: number;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  image?: string;
  clobTokenIds: string; // JSON-encoded string array: [yesTokenId, noTokenId]
}

/** The Yes outcome's CLOB token id — used to fetch real probability history from clob.polymarket.com. */
export function getYesTokenId(market: PolymarketMarket): string | null {
  try {
    const ids = JSON.parse(market.clobTokenIds) as string[];
    return ids[0] ?? null;
  } catch {
    return null;
  }
}

/** Polymarket's tag taxonomy — brief context: leader picked these 4 categories to launch with (Politics/Sports/Esports/Iran held back for a later marketing push). */
export const POLYMARKET_CATEGORIES = {
  CRYPTO: 21,
  FINANCE: 120,
  GEOPOLITICS: 100265,
  TECH: 1401,
} as const;

export type PolymarketCategory = keyof typeof POLYMARKET_CATEGORIES;

/** Fetches open, liquid, binary (Yes/No) markets for one category tag, highest volume first. */
export async function fetchPolymarketMarkets(category: PolymarketCategory, limit = 20): Promise<PolymarketMarket[]> {
  const tagId = POLYMARKET_CATEGORIES[category];
  const url = `${GAMMA_BASE}/markets?active=true&closed=false&tag_id=${tagId}&limit=${limit}&order=volume24hr&ascending=false`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket markets fetch failed: ${res.status}`);
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) throw new Error("unexpected Polymarket response shape");

  return rows.filter((m): m is PolymarketMarket => {
    if (!m || typeof m !== "object") return false;
    const market = m as PolymarketMarket;
    if (!market.conditionId || !market.question || !market.endDate) return false;
    try {
      const outcomes = JSON.parse(market.outcomes) as string[];
      return outcomes.length === 2 && outcomes[0] === "Yes" && outcomes[1] === "No";
    } catch {
      return false;
    }
  });
}

async function fetchByConditionId(conditionId: string): Promise<PolymarketMarket> {
  const res = await fetch(`${GAMMA_BASE}/markets?condition_ids=${conditionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket market lookup failed: ${res.status}`);
  const rows = (await res.json()) as PolymarketMarket[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Polymarket market not found for ${conditionId}`);
  return rows[0];
}

/**
 * Resolution mirrors Polymarket itself (team decision, pending any future
 * change): our market only resolves once Polymarket's own market has
 * actually closed, and the winning side is whichever outcome priced at
 * (effectively) 1. Mapped onto the existing numeric comparison
 * (strike_price=0.5, comparison="gt") so lib/engine/market.ts's
 * resolveMarket() needs no changes at all — "price" here is just the Yes
 * outcome's settled price (0 or 1), not a real market price.
 */
export const polymarketResolver: IOracleResolver = {
  async verifyAndResolve(conditionId: string): Promise<PriceObservation> {
    const market = await fetchByConditionId(conditionId);
    if (!market.closed) {
      throw new Error(`Polymarket market ${conditionId} has not closed yet`);
    }
    const prices = JSON.parse(market.outcomePrices) as string[];
    const yesPrice = Number(prices[0]);
    if (!Number.isFinite(yesPrice)) throw new Error(`Polymarket market ${conditionId} has no valid settled price`);
    // resolveMarket() in lib/engine/market.ts rejects a price of exactly 0
    // as "invalid" (a sanity check meant for real asset prices, which are
    // never legitimately zero) — but a Polymarket market settling to NO is
    // exactly that: outcomePrices[0] = "0". Floor it just above zero so a
    // real NO resolution doesn't get misread as a bad oracle read; the
    // gt-0.5 comparison against strike_price still lands on NO correctly.
    const encodedPrice = yesPrice > 0.5 ? 1 : 0.0001;
    return { price: encodedPrice, observedAt: new Date() };
  },
};
