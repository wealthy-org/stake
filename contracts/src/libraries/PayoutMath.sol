// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PayoutMath
/// @notice Pool settlement + net-loss math (brief §9-§11, §31-§33),
/// ported 1:1 from lib/engine/pool.ts and lib/engine/netloss.ts so the
/// on-chain and off-chain implementations can be cross-tested.
library PayoutMath {
    uint256 internal constant SHARE_PRECISION = 1e18; // brief §33

    struct Settlement {
        bool yesWon;
        uint256 winningPool;
        uint256 losingPool;
        uint256 protocolFee;
        uint256 netLosingPool;
        uint256 rewardPerWinningShare;
    }

    /// @dev Reverts if either side is empty — brief §34/§35: an empty-sided
    /// pool must cancel instead of settling into broken (divide-by-zero) math.
    function settlePools(uint256 yesPool, uint256 noPool, bool yesWon, uint16 protocolFeeBps)
        internal
        pure
        returns (Settlement memory s)
    {
        uint256 winningPool = yesWon ? yesPool : noPool;
        uint256 losingPool = yesWon ? noPool : yesPool;
        require(winningPool > 0 && losingPool > 0, "PayoutMath: empty side, must cancel instead");

        uint256 protocolFee = (losingPool * protocolFeeBps) / 10_000;
        uint256 netLosingPool = losingPool - protocolFee;
        uint256 rewardPerWinningShare = (netLosingPool * SHARE_PRECISION) / winningPool;

        s = Settlement({
            yesWon: yesWon,
            winningPool: winningPool,
            losingPool: losingPool,
            protocolFee: protocolFee,
            netLosingPool: netLosingPool,
            rewardPerWinningShare: rewardPerWinningShare
        });
    }

    function winnerPayout(uint256 winnerStake, uint256 rewardPerWinningShare)
        internal
        pure
        returns (uint256 profit, uint256 totalPayout)
    {
        if (winnerStake == 0) return (0, 0);
        profit = (winnerStake * rewardPerWinningShare) / SHARE_PRECISION;
        totalPayout = winnerStake + profit;
    }

    /// @notice Net realized loss (brief §11/§32) — CRITICAL: computed over
    /// BOTH sides' stake, not just the losing side, so a wallet that bets
    /// both YES and NO cannot farm PAPER by hedging. See brief §11.
    function calcNetLoss(uint256 yesStake, uint256 noStake, bool yesWon, uint256 rewardPerWinningShare)
        internal
        pure
        returns (uint256 totalStake, uint256 totalPayout, int256 netPnL, uint256 realizedLoss)
    {
        totalStake = yesStake + noStake;
        uint256 winnerStake = yesWon ? yesStake : noStake;
        (, totalPayout) = winnerPayout(winnerStake, rewardPerWinningShare);

        netPnL = int256(totalPayout) - int256(totalStake);
        realizedLoss = netPnL < 0 ? uint256(-netPnL) : 0;
    }
}
