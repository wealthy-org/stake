/**
 * Oracle adapter interface — brief §24. Market resolution should call
 * through this interface, never a specific provider's SDK directly, so the
 * provider can be swapped (Binance now → ChainlinkDataStreamsResolver later)
 * without touching lib/engine/market.ts.
 */
export interface PriceObservation {
  price: number;
  observedAt: Date;
}

export interface IOracleResolver {
  /** symbol is the resolver-specific feed identifier (e.g. a Binance pair or a Chainlink feed id). */
  verifyAndResolve(symbol: string): Promise<PriceObservation>;
}
