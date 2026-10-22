import type { IOracleResolver } from "./resolver";
import { binanceResolver } from "./binance";
import { stockOracleResolver } from "./stock";
import { polymarketResolver } from "./polymarket";

/**
 * Maps a market's `oracle_source` prefix (e.g. "binance:ETHUSDT" or "stock:NVDA")
 * to the resolver that handles it. Adding ChainlinkDataStreamsResolver later is a
 * one-line addition here, not a change to lib/engine/market.ts.
 */
const RESOLVERS: Record<string, IOracleResolver> = {
  binance: binanceResolver,
  stock: stockOracleResolver,
  polymarket: polymarketResolver,
};

export function getResolver(oracleSource: string): { resolver: IOracleResolver; feedId: string } {
  const [prefix, feedId] = oracleSource.split(":");
  const resolver = RESOLVERS[prefix];
  if (!resolver) throw new Error(`unsupported oracle source: ${prefix}`);
  return { resolver, feedId };
}

export type { IOracleResolver, PriceObservation } from "./resolver";
export { stockOracleResolver } from "./stock";
