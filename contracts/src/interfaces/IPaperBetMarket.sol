// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPaperBetMarket {
    enum Side {
        YES,
        NO
    }

    enum Comparison {
        GREATER_THAN,
        GREATER_THAN_OR_EQUAL,
        LESS_THAN,
        LESS_THAN_OR_EQUAL
    }

    enum MarketStatus {
        DRAFT,
        OPEN,
        LOCKED,
        RESOLUTION_PENDING,
        RESOLVED,
        CANCELLED
    }

    function initialize(
        bytes32 marketId,
        address collateralToken,
        address oracleResolver,
        address emissionController,
        address feeTreasury,
        bytes32 oracleFeedId,
        uint256 strikePrice,
        Comparison comparison,
        uint64 bettingOpensAt,
        uint64 bettingClosesAt,
        uint64 resolutionTimestamp,
        uint64 resolutionWindow,
        uint16 protocolFeeBps,
        uint256 minBet,
        uint256 maxBet
    ) external;

    function bet(Side side, uint256 amount) external;
    function resolve(bytes calldata report, bytes calldata extraData) external;
    function cancel(bytes32 reason) external;
    function claimPayout() external returns (uint256 amount);
    function claimLossReward() external returns (uint256 realizedLoss, uint256 paperMinted);
}
