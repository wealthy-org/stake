// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title EmissionMath
/// @notice Piecewise emission curve (brief §16/§17), ported 1:1 from the
/// backend-logic phase's lib/engine/emission.ts so the two stay in sync.
/// TESTNET-ONLY tiers — brief §16 explicitly says this exact curve is NOT
/// approved mainnet tokenomics. Collateral amounts assume 1e6 base units
/// (a 6-decimal stablecoin); VERIFY the real collateral token's decimals
/// before mainnet (brief §18) and adjust DOLLAR below if it differs.
library EmissionMath {
    uint256 internal constant DOLLAR = 1_000_000; // 1e6 collateral base units == $1
    uint256 internal constant RATE_SCALE = 1_000_000; // ratePerDollarScaled precision

    uint256 internal constant TIER0_CEILING = 100_000 * DOLLAR; // $100k
    uint256 internal constant TIER1_CEILING = 1_000_000 * DOLLAR; // $1m
    uint256 internal constant TIER2_CEILING = 10_000_000 * DOLLAR; // $10m

    uint256 internal constant TIER0_RATE = 100 * RATE_SCALE; // 100 PAPER / $1
    uint256 internal constant TIER1_RATE = 40 * RATE_SCALE; // 40 PAPER / $1
    uint256 internal constant TIER2_RATE = 10 * RATE_SCALE; // 10 PAPER / $1
    uint256 internal constant TIER3_RATE = 3 * RATE_SCALE; // 3 PAPER / $1 (unbounded tier)

    /// @notice Piecewise emission across tier boundaries (brief §17): a loss
    /// that crosses a threshold is split and each slice charged at its own
    /// tier's rate, instead of applying one rate to the whole loss.
    function calcEmission(uint256 cumulativeLossBefore, uint256 lossAmount) internal pure returns (uint256 minted) {
        if (lossAmount == 0) return 0;

        uint256 remaining = lossAmount;
        uint256 cursor = cumulativeLossBefore;

        (minted, remaining, cursor) = _applyTier(minted, remaining, cursor, TIER0_CEILING, TIER0_RATE);
        (minted, remaining, cursor) = _applyTier(minted, remaining, cursor, TIER1_CEILING, TIER1_RATE);
        (minted, remaining, cursor) = _applyTier(minted, remaining, cursor, TIER2_CEILING, TIER2_RATE);
        if (remaining > 0) {
            // unbounded last tier — no ceiling to clip against
            minted += remaining * TIER3_RATE * RATE_SCALE;
        }
    }

    function _applyTier(uint256 mintedSoFar, uint256 remaining, uint256 cursor, uint256 ceiling, uint256 rateScaled)
        private
        pure
        returns (uint256 newMinted, uint256 newRemaining, uint256 newCursor)
    {
        if (remaining == 0 || cursor >= ceiling) {
            return (mintedSoFar, remaining, cursor);
        }
        uint256 spaceInTier = ceiling - cursor;
        uint256 slice = spaceInTier < remaining ? spaceInTier : remaining;

        // emission_base_units(1e18) = slice(1e6) * rateScaled(1e6) * 1e6
        newMinted = mintedSoFar + slice * rateScaled * RATE_SCALE;
        newCursor = cursor + slice;
        newRemaining = remaining - slice;
    }

    function currentRatePerDollar(uint256 cumulativeLoss) internal pure returns (uint256 rateScaled) {
        if (cumulativeLoss < TIER0_CEILING) return TIER0_RATE;
        if (cumulativeLoss < TIER1_CEILING) return TIER1_RATE;
        if (cumulativeLoss < TIER2_CEILING) return TIER2_RATE;
        return TIER3_RATE;
    }
}
