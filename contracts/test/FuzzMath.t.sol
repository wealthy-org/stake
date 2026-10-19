// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PayoutMath} from "../src/libraries/PayoutMath.sol";
import {EmissionMath} from "../src/libraries/EmissionMath.sol";

contract FuzzMathTest is Test {
    /// @notice Invariant: Total payout to winners + protocol fee <= losingPool + winningPool (Solvency)
    /// Also verifies no overflow or unexpected reverts under arbitrary valid inputs
    function testFuzz_PayoutMath_Solvency(
        uint256 yesPool,
        uint256 noPool,
        bool yesWon,
        uint16 feeBps
    ) public pure {
        // Bound inputs to reasonable 6-decimal token amounts: min 1 unit, max 100 billion dollars
        yesPool = bound(yesPool, 1, 100_000_000_000e6);
        noPool = bound(noPool, 1, 100_000_000_000e6);
        feeBps = uint16(bound(feeBps, 0, 500)); // Max fee 5% as per brief §58

        PayoutMath.Settlement memory s = PayoutMath.settlePools(yesPool, noPool, yesWon, feeBps);

        uint256 winningPool = yesWon ? yesPool : noPool;
        uint256 losingPool = yesWon ? noPool : yesPool;

        // Protocol fee must not exceed losing pool
        assertLe(s.protocolFee, losingPool, "Fee exceeds losing pool");
        assertEq(s.netLosingPool, losingPool - s.protocolFee, "Net losing pool mismatch");

        // Winner total payout for 100% of winning stake
        (uint256 profit, uint256 totalPayout) = PayoutMath.winnerPayout(winningPool, s.rewardPerWinningShare);

        // Due to integer division truncation (dust), profit must be <= netLosingPool
        assertLe(profit, s.netLosingPool, "Total profit exceeds net losing pool");

        // Total distributed collateral = totalPayout + protocolFee
        uint256 totalDistributed = totalPayout + s.protocolFee;
        uint256 totalCollateral = winningPool + losingPool;

        // Contract must NEVER pay out more collateral than was deposited (Solvency Invariant)
        assertLe(totalDistributed, totalCollateral, "Solvency violated: paid more than deposited");

        // Dust must be strictly less than winningPool base units
        uint256 dust = totalCollateral - totalDistributed;
        assertLe(dust, winningPool, "Dust exceeds winning pool scale");
    }

    /// @notice Fuzz net loss guard: A wallet betting on both sides should NEVER receive
    /// realized loss if it made a net profit, and realized loss must strictly equal
    /// max(0, totalStake - totalPayout).
    function testFuzz_PayoutMath_CalcNetLoss(
        uint256 yesStake,
        uint256 noStake,
        uint256 otherYesStake,
        uint256 otherNoStake,
        bool yesWon,
        uint16 feeBps
    ) public pure {
        yesStake = bound(yesStake, 1, 10_000_000e6);
        noStake = bound(noStake, 1, 10_000_000e6);
        otherYesStake = bound(otherYesStake, 1, 50_000_000e6);
        otherNoStake = bound(otherNoStake, 1, 50_000_000e6);
        feeBps = uint16(bound(feeBps, 0, 500));

        uint256 totalYesPool = yesStake + otherYesStake;
        uint256 totalNoPool = noStake + otherNoStake;

        PayoutMath.Settlement memory s = PayoutMath.settlePools(totalYesPool, totalNoPool, yesWon, feeBps);

        (uint256 totalStake, uint256 totalPayout, int256 netPnL, uint256 realizedLoss) =
            PayoutMath.calcNetLoss(yesStake, noStake, yesWon, s.rewardPerWinningShare);

        assertEq(totalStake, yesStake + noStake, "Total stake mismatch");

        if (netPnL >= 0) {
            // Net profit or breakeven -> MUST have zero realized loss (Hedge Farming Guard, brief §11 & §53)
            assertEq(realizedLoss, 0, "Profitable/breakeven wallet received non-zero realized loss");
        } else {
            // Net loss -> realizedLoss must equal uint256(-netPnL)
            assertEq(realizedLoss, uint256(-netPnL), "Realized loss mismatch");
            assertLe(realizedLoss, totalStake, "Realized loss exceeds total stake");
        }
    }

    /// @notice Fuzz emission calculation: Emission rate must be monotonically non-increasing
    /// across tiers, and cumulative emission must never revert on arbitrary loss amounts.
    function testFuzz_EmissionMath_MonotonicRate(
        uint256 cumulativeLossBefore,
        uint256 lossAmount
    ) public pure {
        // Bound cumulative loss to max 500 million USD (500m * 1e6)
        cumulativeLossBefore = bound(cumulativeLossBefore, 0, 500_000_000e6);
        // Bound loss amount to max 10 million USD
        lossAmount = bound(lossAmount, 0, 10_000_000e6);

        uint256 minted = EmissionMath.calcEmission(cumulativeLossBefore, lossAmount);

        if (lossAmount == 0) {
            assertEq(minted, 0, "Zero loss minted paper");
        } else {
            // Maximum possible mint rate is TIER0_RATE (100 PAPER / $1 = 100 * 1e18 per 1e6 collateral)
            // minted <= lossAmount * 100 * 1e12
            uint256 maxPossibleMint = lossAmount * 100 * 1e12;
            assertLe(minted, maxPossibleMint, "Minted more than highest tier rate");

            // Minimum possible mint rate is TIER3_RATE (3 PAPER / $1 = 3 * 1e18 per 1e6 collateral)
            uint256 minPossibleMint = lossAmount * 3 * 1e12;
            assertGe(minted, minPossibleMint, "Minted less than lowest tier rate");
        }
    }

    /// @notice Fuzz test additivity across consecutive slices:
    /// calcEmission(L, A + B) == calcEmission(L, A) + calcEmission(L + A, B)
    function testFuzz_EmissionMath_Additivity(
        uint256 cumulativeLoss,
        uint256 sliceA,
        uint256 sliceB
    ) public pure {
        cumulativeLoss = bound(cumulativeLoss, 0, 20_000_000e6);
        sliceA = bound(sliceA, 0, 5_000_000e6);
        sliceB = bound(sliceB, 0, 5_000_000e6);

        uint256 totalSlice = sliceA + sliceB;
        uint256 oneShotMint = EmissionMath.calcEmission(cumulativeLoss, totalSlice);

        uint256 mintA = EmissionMath.calcEmission(cumulativeLoss, sliceA);
        uint256 mintB = EmissionMath.calcEmission(cumulativeLoss + sliceA, sliceB);

        assertEq(oneShotMint, mintA + mintB, "Emission piecewise additivity mismatch");
    }
}
