// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";

/// Validates the accumulator pattern fine2's "Skenario B" proposal needs:
/// points from net-loss, reward deposits that never promise more than the
/// vault actually holds, and fair proportional claims regardless of when
/// each wallet's points were added relative to a deposit.
contract RewardVaultTest is Test {
    RewardVault vault;
    MockCollateral rewardToken;

    address admin = address(0xAD41);
    address pointsSource = address(0x90137705); // "POINTS" role holder
    address depositor = address(0xDE905170); // "DEPOSITOR" role holder
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        rewardToken = new MockCollateral();
        vault = new RewardVault(admin, rewardToken);

        vm.startPrank(admin);
        vault.setRole(vault.POINTS_ROLE(), pointsSource, true);
        vault.setRole(vault.DEPOSITOR_ROLE(), depositor, true);
        vm.stopPrank();

        rewardToken.mint(depositor, 1_000_000e6);
        vm.prank(depositor);
        rewardToken.approve(address(vault), type(uint256).max);
    }

    function test_depositBeforeAnyPoints_reverts() public {
        vm.prank(depositor);
        vm.expectRevert("RewardVault: no points to distribute to yet");
        vault.depositReward(100e6);
    }

    function test_singleHolder_getsEverythingDeposited() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        vm.prank(depositor);
        vault.depositReward(1_000e6);

        assertEq(vault.pendingReward(alice), 1_000e6, "alice should be owed the full deposit, she's the only holder");

        vm.prank(alice);
        uint256 claimed = vault.claim();
        assertEq(claimed, 1_000e6);
        assertEq(rewardToken.balanceOf(alice), 1_000e6);
        assertEq(vault.pendingReward(alice), 0);
    }

    function test_twoHoldersAtDepositTime_splitProportionally() public {
        // Alice has 3x Bob's points at the moment of deposit -> 3x the reward.
        vm.startPrank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 300e6);
        vault.accruePoints(bob, bytes32("m1"), 100e6);
        vm.stopPrank();

        vm.prank(depositor);
        vault.depositReward(400e6);

        assertEq(vault.pendingReward(alice), 300e6);
        assertEq(vault.pendingReward(bob), 100e6);
    }

    function test_pointsAddedAfterDeposit_dontStealAlreadyAccruedShare() public {
        // Alice is the only holder when the first deposit lands.
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        vm.prank(depositor);
        vault.depositReward(1_000e6);

        // Bob only starts earning points after that deposit already happened.
        vm.prank(pointsSource);
        vault.accruePoints(bob, bytes32("m2"), 100e6);

        // Bob must not retroactively claim a share of the deposit that
        // happened before he had any points at all.
        assertEq(vault.pendingReward(bob), 0, "bob had zero points when the only deposit so far happened");
        assertEq(vault.pendingReward(alice), 1_000e6, "alice's earlier-earned share must be untouched");
    }

    function test_laterDeposit_splitsAcrossWhoeverHoldsPointsByThen() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        vm.prank(depositor);
        vault.depositReward(1_000e6); // alice-only round: she gets all of this

        vm.prank(pointsSource);
        vault.accruePoints(bob, bytes32("m2"), 100e6); // now alice and bob hold equal points

        vm.prank(depositor);
        vault.depositReward(200e6); // split 50/50 between alice and bob this time

        assertEq(vault.pendingReward(alice), 1_000e6 + 100e6);
        assertEq(vault.pendingReward(bob), 100e6);
    }

    function test_claim_neverExceedsVaultBalance() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        vm.prank(depositor);
        vault.depositReward(500e6);

        vm.prank(alice);
        vault.claim();

        assertEq(rewardToken.balanceOf(address(vault)), 0, "vault should hold exactly zero after its only holder claims everything owed");
    }

    function test_claimWithNothingPending_reverts() public {
        vm.prank(alice);
        vm.expectRevert("RewardVault: nothing to claim");
        vault.claim();
    }

    function test_onlyPointsRole_canAccruePoints() public {
        vm.expectRevert();
        vault.accruePoints(alice, bytes32("m1"), 100e6);
    }

    function test_onlyDepositorRole_canDeposit() public {
        vm.prank(pointsSource);
        vault.accruePoints(alice, bytes32("m1"), 100e6);

        vm.expectRevert();
        vault.depositReward(100e6);
    }
}
