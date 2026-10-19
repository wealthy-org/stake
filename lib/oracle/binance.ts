import type { IOracleResolver, PriceObservation } from "./resolver";

// Oracle source for Paper Bet's backend-logic phase: Binance public market
// data, same source paper-arena uses. Brief §24/§25 call for a Chainlink
// Data Streams resolver on Robinhood Chain once contracts exist; this
// implements the same IOracleResolver interface a ChainlinkDataStreamsResolver
// will, so swapping it out later doesn't touch lib/engine/market.ts.

const BASE = process.env.BINANCE_API_BASE ?? "https://api.binance.com";

/** symbol is a Binance pair like "ETHUSDT". */
async function fetchPrice(symbol: string): Promise<PriceObservation> {
  const res = await fetch(`${BASE}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Binance price fetch failed for ${symbol}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { price: string };
  return { price: Number(data.price), observedAt: new Date() };
}

export const binanceResolver: IOracleResolver = {
  verifyAndResolve: fetchPrice,
};
