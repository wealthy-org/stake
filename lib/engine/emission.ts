/**
 * Emission curve per brief §16/§17. NOT locked mainnet tokenomics — this is
 * a testnet-only default curve so the piecewise-boundary-crossing logic
 * (§17) can be built and tested. Swap TESTNET_EMISSION_TIERS for whatever
 * the product owner finalizes before any real deployment (brief §75).
 *
 * Tiers are expressed as "up to this many cumulative dollars of realized
 * loss, emit this many PAPER per $1". `upToBaseUnits = null` means
 * unbounded (the last tier).
 */
export interface EmissionTier {
  upToBaseUnits: bigint | null; // cumulative-loss threshold, in 1e6 collateral base units
  ratePerDollarScaled: bigint; // PAPER per $1, scaled by 1e6 for fractional precision
}

const DOLLAR = 1_000_000n; // 1e6 collateral base units == $1

function tier(upToDollars: number | null, ratePerDollar: number): EmissionTier {
  return {
    upToBaseUnits: upToDollars === null ? null : BigInt(upToDollars) * DOLLAR,
    ratePerDollarScaled: BigInt(Math.round(ratePerDollar * 1_000_000)),
  };
}

export const TESTNET_EMISSION_TIERS: EmissionTier[] = [
  tier(100_000, 100),
  tier(1_000_000, 40),
  tier(10_000_000, 10),
  tier(null, 3),
];

/**
 * Piecewise emission across tier boundaries (brief §17). Walks the loss
 * amount through each tier the cumulative total crosses, charging each
 * slice at that tier's rate instead of applying one rate to the whole loss.
 */
export function calcEmission(
  cumulativeLossBefore: bigint,
  lossAmount: bigint,
  tiers: EmissionTier[] = TESTNET_EMISSION_TIERS
): bigint {
  if (lossAmount <= 0n) return 0n;

  let remaining = lossAmount;
  let cursor = cumulativeLossBefore;
  let minted = 0n;

  for (const t of tiers) {
    if (remaining <= 0n) break;
    const tierCeiling = t.upToBaseUnits;
    if (tierCeiling !== null && cursor >= tierCeiling) continue; // already past this tier

    const spaceInTier = tierCeiling === null ? remaining : tierCeiling - cursor;
    const slice = spaceInTier < remaining ? spaceInTier : remaining;

    // emission_base_units(1e18) = slice(1e6) * ratePerDollarScaled(1e6) * 1e6
    minted += slice * t.ratePerDollarScaled * 1_000_000n;

    cursor += slice;
    remaining -= slice;
  }

  return minted;
}

export function previewRateAt(cumulativeLoss: bigint, tiers: EmissionTier[] = TESTNET_EMISSION_TIERS): number {
  for (const t of tiers) {
    if (t.upToBaseUnits === null || cumulativeLoss < t.upToBaseUnits) {
      return Number(t.ratePerDollarScaled) / 1_000_000;
    }
  }
  return 0;
}
