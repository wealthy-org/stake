export type Comparison = "gt" | "gte" | "lt" | "lte";

/**
 * Explicit comparison evaluation per brief §7 — "above" must map to a named
 * enum, never an implicit operator, and an exact-strike match always
 * resolves to the comparison's boolean, not a special "tie" case (e.g.
 * GREATER_THAN at exactly the strike price means NO wins).
 */
export function evaluateComparison(comparison: Comparison, observedPrice: number, strikePrice: number): boolean {
  switch (comparison) {
    case "gt":
      return observedPrice > strikePrice;
    case "gte":
      return observedPrice >= strikePrice;
    case "lt":
      return observedPrice < strikePrice;
    case "lte":
      return observedPrice <= strikePrice;
  }
}
