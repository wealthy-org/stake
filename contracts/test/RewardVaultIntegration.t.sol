// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {RewardVault} from "../src/RewardVault.sol";
import {FeeTreasury} from "../src/FeeTreasury.sol";
import {PaperBetMarket} from "../src/PaperBetMarket.sol";
import {IPaperBetMarket} from "../src/interfaces/IPaperBetMarket.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";
import {MockOracleResolver} from "../src/mocks/MockOracleResolver.sol";

/// Proves PaperBetMarket.sol needs ZERO changes to run under fine2's
/// points+vault model: a RewardVault stands in directly for
/// IEmissionController (same `emissionController` address slot at
/// initialize time) — the market contract itself neither knows nor cares
/// which one is behind that address, because PaperBetMarket.initialize()
/// already only ever wraps it as the IEmissionController interface.
///
/// Deploys the market directly (bypassing PaperBetFactory, which is
/// hard-wired to the concrete EmissionController type and its
/// `registerMarket` call — a factory-level choice to revisit if/when this
/// becomes the real deployment path, not a limitation of the market or
/// the vault themselves).
contract RewardVaultIntegrationTest is Test {
    MockCollateral collateral;
    MockCollateral rewardToken; // stands in for the real (fixed-supply, Pons-launched) STAKE token
    RewardVault vault;
    PaperBetMarket market;
    MockOracleResolver oracle;

    address admin = address(0xAD41);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address treasuryBuyer = address(0x7EA5012);

    bytes32 marketId = keccak256("integration-market-1");

    function setUp() public {
        collateral = new MockCollateral();
        rewardToken = new MockCollateral();
        vault = new RewardVault(admin, rewardToken);
        oracle = new MockOracleResolver();
        market = new PaperBetMarket();

        FeeTreasury feeTreasury = new FeeTreasury(admin);

        uint64 nowTs = uint64(block.timestamp);

        market.initialize(
            marketId,
            address(collateral),
            address(oracle),
            address(vault), // <-- the only swap: RewardVault instead of EmissionController, same slot
            address(feeTreasury),
            bytes32(0),
            5_000e8,
            IPaperBetMarket.Comparison.GREATER_THAN,
            nowTs,
            nowTs + 1 hours,
            nowTs + 1 hours + 5 minutes,
            900,
            200,
            1e6,
            1_000e6
        );

        // Equivalent of Deploy.s.sol granting EmissionController.MARKET_ROLE
        // to a newly created market clone.
        vm.startPrank(admin);
        vault.setRole(vault.POINTS_ROLE(), address(market), true);
        vm.stopPrank();

        collateral.mint(alice, 1_000e6);
        collateral.mint(bob, 1_000e6);
    }

    function test_marketResolvedLoss_flowsIntoRewardVaultAsPoints_andIsClaimableOnceFunded() public {
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 100e6);
        vm.stopPrank();

        vm.startPrank(bob);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.NO, 100e6);
        vm.stopPrank();

        uint64 resolutionTs = uint64(block.timestamp) + 1 hours + 5 minutes;
        vm.warp(resolutionTs);

        // Price below strike -> NO wins, alice (YES) has a full net loss.
        bytes memory report = abi.encode(uint256(4_000e8), resolutionTs);
        market.resolve(report, hex"");

        vm.prank(alice);
        (uint256 realizedLoss, uint256 pointsAdded) = market.claimLossReward();

        assertGt(realizedLoss, 0, "alice should have a nonzero net loss");
        assertEq(pointsAdded, realizedLoss, "points accrue 1:1 with realized loss, no emission curve");
        assertEq(vault.pendingPoints(alice), realizedLoss, "alice points should be in pending purchase status");
        assertEq(vault.pendingReward(alice), 0, "no batch has been settled yet, so nothing is claimable yet");

        // Treasury now buys the reward token on the open market (simulated
        // here as a mint, since the real purchase happens off-chain against
        // the Pons/Uniswap v4 pool) and settles the batch.
        rewardToken.mint(treasuryBuyer, 1_000e6);
        vm.startPrank(admin);
        vault.setRole(vault.DEPOSITOR_ROLE(), treasuryBuyer, true);
        vm.stopPrank();

        vm.startPrank(treasuryBuyer);
        rewardToken.approve(address(vault), 1_000e6);
        address[] memory users = new address[](1);
        users[0] = alice;
        vault.settleBatch(users, 1_000e6, bytes32("tx-buy-pons"));
        vm.stopPrank();

        // Alice's pending points are now burned, and she has allocated STAKE ready to claim
        assertEq(vault.pendingPoints(alice), 0, "alice points should be burned after batch settlement");
        assertEq(vault.pendingReward(alice), 1_000e6, "alice allocated stake should be ready to claim");
        assertEq(vault.allocatedStake(alice), 1_000e6);

        vm.prank(alice);
        vault.claim();
        assertEq(rewardToken.balanceOf(alice), 1_000e6);
        assertEq(vault.claimedStake(alice), 1_000e6);
        assertEq(vault.allocatedStake(alice), 0);

        // Cannot claim again
        vm.prank(alice);
        vm.expectRevert("RewardVault: nothing to claim");
        vault.claim();
    }
}
