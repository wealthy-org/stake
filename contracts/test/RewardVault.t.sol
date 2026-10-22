// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";

/// @notice Validates the revised Stake Points Reward mechanism:
/// 1 point = $1 treasury buy budget, batch buys on open market,
/// points permanently burned upon batch settlement, no repeat rewards.
contract RewardVaultTest is Test {
    RewardVault vault;
    MockCollateral rewardToken;

    address admin = address(0xAD41);
    address pointsSource = address(0x90137705); // "POINTS" role holder
    address depositor = address(0xDE905170); // "DEPOSITOR" role holder
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address charlie = address(0xCC01);

    function setUp() public {
        rewardToken = new MockCollateral();
        vault = new RewardVault(admin, rewardToken);

        vm.startPrank(admin);
        vault.setRole(vault.POINTS_ROLE(), pointsSource, true);
        vault.setRole(vault.DEPOSITOR_ROLE(), depositor, true);
        vm.stopPrank();

        rewardToken.mint(depositor, 1_000_000e18);
        vm.prank(depositor);
        rewardToken.approve(address(vault), type(uint256).max);
    }

    function test_accruePoints_recordsPendingPoints() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        assertEq(vault.pendingPoints(alice), 100e6);
        assertEq(vault.totalPendingPoints(), 100e6);
        assertEq(vault.allocatedStake(alice), 0, "no STAKE allocated before batch buy");
        assertEq(vault.getPendingUsersCount(), 1);
        assertEq(vault.getPendingUsers()[0], alice);
    }

    function test_accruePoints_duplicateMarketLoss_reverts() public {
        vm.startPrank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        // Same marketId for same user must revert (Brief §1)
        vm.expectRevert("RewardVault: market loss already recorded");
        vault.accruePoints(alice, bytes32("m1"), 50e6);
        vm.stopPrank();
    }

    function test_singleHolder_batchSettlement_burnsPointsAndAllocatesStake() public {
        // Alice loses $10 -> 10 points ($10 budget)
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 10e18);

        // Treasury executes open-market buy with $10 budget and receives 200 STAKE
        vm.prank(depositor);
        address[] memory users = new address[](1);
        users[0] = alice;
        vault.settleBatch(users, 200e18, bytes32("tx_buy_1"));

        // Points must be burned
        assertEq(vault.pendingPoints(alice), 0, "points must be burned after batch conversion");
        assertEq(vault.totalPendingPoints(), 0);
        assertEq(vault.totalPointsSettled(), 10e18);

        // 200 STAKE allocated
        assertEq(vault.allocatedStake(alice), 200e18);
        assertEq(vault.pendingReward(alice), 200e18);

        // Alice claims her allocated STAKE
        vm.prank(alice);
        uint256 claimed = vault.claim();
        assertEq(claimed, 200e18);
        assertEq(rewardToken.balanceOf(alice), 200e18);
        assertEq(vault.claimedStake(alice), 200e18);
        assertEq(vault.allocatedStake(alice), 0);
    }

    function test_multipleHolders_splitProportionally() public {
        // Alice has 10 points ($10), Bob has 90 points ($90) -> Total 100 points ($100 budget)
        vm.startPrank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 10e18);
        vault.accruePoints(bob, bytes32("m1"), 90e18);
        vm.stopPrank();

        // Treasury spends $100 and buys 2,000 STAKE
        vm.prank(depositor);
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        vault.settleBatch(users, 2_000e18, bytes32("tx_batch_100"));

        // Alice gets 10% = 200 STAKE, Bob gets 90% = 1800 STAKE
        assertEq(vault.allocatedStake(alice), 200e18);
        assertEq(vault.allocatedStake(bob), 1800e18);

        // Both points burned
        assertEq(vault.pendingPoints(alice), 0);
        assertEq(vault.pendingPoints(bob), 0);
        assertEq(vault.getPendingUsersCount(), 0);
    }

    function test_pointsBurned_cannotReceiveFromSubsequentBatches() public {
        // 1. Alice earns 100 points in Batch 1
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e18);

        // Treasury buys 2,000 STAKE for Batch 1
        address[] memory batch1Users = new address[](1);
        batch1Users[0] = alice;
        vm.prank(depositor);
        vault.settleBatch(batch1Users, 2_000e18, bytes32("tx_batch_1"));

        assertEq(vault.allocatedStake(alice), 2_000e18);
        assertEq(vault.pendingPoints(alice), 0, "Alice points must be 0 after Batch 1");

        // 2. Bob joins later in a new market and earns 50 points
        vm.prank(pointsSource);
        vault.accruePoints(bob, bytes32("m2"), 50e18);

        // Treasury buys 1,000 STAKE for Batch 2 (Bob only)
        address[] memory batch2Users = new address[](1);
        batch2Users[0] = bob;
        vm.prank(depositor);
        vault.settleBatch(batch2Users, 1_000e18, bytes32("tx_batch_2"));

        // CRITICAL CHECK: Alice's allocated stake MUST NOT increase from Batch 2!
        // Old points do NOT receive repeat rewards!
        assertEq(vault.allocatedStake(alice), 2_000e18, "Alice must NOT get anything from Batch 2");
        assertEq(vault.allocatedStake(bob), 1_000e18, "Bob gets the full Batch 2 allocation");
    }

    function test_settleAllPending_convenience() public {
        vm.startPrank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 50e18);
        vault.accruePoints(bob, bytes32("m2"), 50e18);
        vm.stopPrank();

        assertEq(vault.getPendingUsersCount(), 2);

        vm.prank(depositor);
        vault.settleAllPending(1_000e18, bytes32("tx_all"));

        assertEq(vault.allocatedStake(alice), 500e18);
        assertEq(vault.allocatedStake(bob), 500e18);
        assertEq(vault.getPendingUsersCount(), 0);
    }

    function test_partialPointsSettlement() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e18);

        // Treasury only settles 40 points in this batch with 400 STAKE
        address[] memory users = new address[](1);
        users[0] = alice;
        uint256[] memory pointsToBurn = new uint256[](1);
        pointsToBurn[0] = 40e18;

        vm.prank(depositor);
        vault.settleBatch(users, pointsToBurn, 400e18, bytes32("tx_partial"));

        assertEq(vault.allocatedStake(alice), 400e18);
        assertEq(vault.pendingPoints(alice), 60e18, "remaining 60 points stay pending");
        assertEq(vault.getPendingUsersCount(), 1, "alice still has pending points");
    }

    function test_claimWithNothingPending_reverts() public {
        vm.prank(alice);
        vm.expectRevert("RewardVault: nothing to claim");
        vault.claim();
    }

    function test_doubleClaim_reverts() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 10e18);

        address[] memory users = new address[](1);
        users[0] = alice;
        vm.prank(depositor);
        vault.settleBatch(users, 100e18, bytes32("tx1"));

        vm.prank(alice);
        vault.claim();

        vm.prank(alice);
        vm.expectRevert("RewardVault: nothing to claim");
        vault.claim();
    }

    function test_settleBatch_revertsOnInsufficientPoints() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 10e18);

        address[] memory users = new address[](1);
        users[0] = alice;
        uint256[] memory pointsToBurn = new uint256[](1);
        pointsToBurn[0] = 20e18; // Alice only has 10!

        vm.prank(depositor);
        vm.expectRevert("RewardVault: insufficient pending points");
        vault.settleBatch(users, pointsToBurn, 100e18, bytes32("tx_fail"));
    }

    function test_settleBatch_revertsOnZeroStakePurchased() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 10e18);

        address[] memory users = new address[](1);
        users[0] = alice;

        vm.prank(depositor);
        vm.expectRevert("RewardVault: stake purchased must be > 0");
        vault.settleBatch(users, 0, bytes32("tx_zero"));
    }

    function test_batchHistory_recordedAccurately() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e18);

        address[] memory users = new address[](1);
        users[0] = alice;
        vm.prank(depositor);
        vault.settleBatch(users, 2_000e18, bytes32("tx_ref_abc"));

        assertEq(vault.getBatchHistoryCount(), 1);
        RewardVault.BatchRecord memory rec = vault.getBatch(0);
        assertEq(rec.batchId, 0);
        assertEq(rec.totalPointsBurned, 100e18);
        assertEq(rec.totalStakePurchased, 2_000e18);
        assertEq(rec.conversionRatio, 20e18);
        assertEq(rec.txHash, bytes32("tx_ref_abc"));
        assertEq(rec.userCount, 1);
    }

    function test_onlyPointsRole_canAccruePoints() public {
        vm.expectRevert();
        vault.accruePoints(alice, bytes32("m1"), 100e6);
    }

    function test_onlyDepositorRole_canSettleBatch() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        address[] memory users = new address[](1);
        users[0] = alice;

        vm.expectRevert();
        vault.settleBatch(users, 100e18, bytes32(0));
    }
}
