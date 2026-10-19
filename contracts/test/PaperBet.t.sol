// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {PaperToken} from "../src/PaperToken.sol";
import {EmissionController} from "../src/EmissionController.sol";
import {ProtocolPause} from "../src/ProtocolPause.sol";
import {FeeTreasury} from "../src/FeeTreasury.sol";
import {PaperBetFactory} from "../src/PaperBetFactory.sol";
import {PaperBetMarket} from "../src/PaperBetMarket.sol";
import {IPaperBetMarket} from "../src/interfaces/IPaperBetMarket.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";
import {MockOracleResolver} from "../src/mocks/MockOracleResolver.sol";

/// Mirrors scripts/stress.ts and scripts/selftest.ts in the backend-logic
/// phase — same scenarios, same brief section references, so the two
/// implementations can be checked against each other.
contract PaperBetTest is Test {
    MockCollateral collateral;
    PaperToken paper;
    EmissionController emission;
    ProtocolPause pause;
    FeeTreasury treasury;
    MockOracleResolver oracle;
    PaperBetFactory factory;
    PaperBetMarket implementation;

    address admin = address(0xAD41);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        collateral = new MockCollateral();
        paper = new PaperToken(admin);
        emission = new EmissionController(admin, paper);
        pause = new ProtocolPause(admin);
        treasury = new FeeTreasury(admin);
        oracle = new MockOracleResolver();
        implementation = new PaperBetMarket();

        factory = new PaperBetFactory(
            admin, address(implementation), address(collateral), address(oracle), emission, address(treasury), pause
        );

        vm.startPrank(admin);
        paper.grantRole(paper.EMISSION_ROLE(), address(emission));
        emission.grantRole(emission.FACTORY_ROLE(), address(factory));
        vm.stopPrank();

        collateral.mint(alice, 1_000_000e6);
        collateral.mint(bob, 1_000_000e6);
    }

    function _createMarket(uint64 opensIn, uint64 closesIn, uint64 resolvesIn, uint16 feeBps, uint256 minBet, uint256 maxBet)
        internal
        returns (PaperBetMarket market)
    {
        PaperBetFactory.CreateMarketParams memory p = PaperBetFactory.CreateMarketParams({
            marketId: keccak256(abi.encode(block.timestamp, opensIn, closesIn)),
            oracleFeedId: bytes32(0),
            strikePrice: 5000e8,
            comparison: IPaperBetMarket.Comparison.GREATER_THAN,
            bettingOpensAt: uint64(block.timestamp) + opensIn,
            bettingClosesAt: uint64(block.timestamp) + closesIn,
            resolutionTimestamp: uint64(block.timestamp) + resolvesIn,
            resolutionWindow: 300,
            protocolFeeBps: feeBps,
            minBet: minBet,
            maxBet: maxBet,
            question: "test market"
        });
        vm.prank(admin);
        market = PaperBetMarket(factory.createMarket(p));
    }

    function _report(uint256 price, uint64 observedAt) internal pure returns (bytes memory) {
        return abi.encode(price, observedAt);
    }

    /// Brief §9/§10's own worked example: 60k YES / 40k NO, 2% fee, YES wins.
    /// Alice's 6,000 YES stake should net exactly the brief's numbers (minus
    /// §33's acknowledged integer-division dust).
    function test_WorkedExample_PoolSettlement() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 200, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 6_000e6);
        vm.stopPrank();

        vm.startPrank(bob);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 54_000e6); // yesPool = 60,000
        market.bet(IPaperBetMarket.Side.NO, 40_000e6); // noPool = 40,000
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours + 1);
        market.resolve(_report(5084e8, uint64(block.timestamp)), "");

        assertEq(market.protocolFee(), 800e6, "fee = 800 (2% of 40k)");
        assertEq(market.netLosingPool(), 39_200e6, "net losing pool = 39,200");

        vm.prank(alice);
        uint256 payout = market.claimPayout();
        // 6,000 stake + 3,920 profit = 9,920, minus <=1 unit of §33 rounding dust
        assertApproxEqAbs(payout, 9_920e6, 1, "Alice's payout ~= brief's worked example");
    }

    /// Brief §11: a wallet that bets BOTH sides must only mint PAPER on its
    /// NET loss, not the gross losing-side stake — the core anti-farming rule.
    function test_NetLossGuard_HedgedWalletZeroLoss() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 0, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 100e6);
        market.bet(IPaperBetMarket.Side.NO, 100e6);
        vm.stopPrank();

        vm.prank(bob);
        collateral.approve(address(market), type(uint256).max);
        vm.prank(bob);
        market.bet(IPaperBetMarket.Side.YES, 900e6); // yesPool=1000, noPool=100

        vm.warp(block.timestamp + 2 hours + 1);
        market.resolve(_report(5084e8, uint64(block.timestamp)), "");

        vm.prank(alice);
        market.claimPayout();

        vm.prank(alice);
        (uint256 realizedLoss, uint256 paperMinted) = market.claimLossReward();
        // Alice's 100 NO stake "loses", but her 100 YES stake pays out
        // 100 + 100*100/1000 = 110, so total payout 110 >= total stake 200? No:
        // totalStake=200, totalPayout=110 (only YES side pays), netPnL = -90,
        // so SOME realized loss is expected here, but it must be the NET
        // figure (90), not the gross NO stake (100).
        assertEq(realizedLoss, 90e6, "net loss uses NET pnl, not gross losing-side stake");
        assertTrue(paperMinted > 0, "net-loss wallet does mint PAPER on the real net figure");
    }

    /// Brief §53: if total payout >= total stake, PAPER must be exactly zero
    /// even though the wallet had a losing position on one side.
    function test_NetLossGuard_ProfitableHedgeZeroPaper() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 0, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 100e6);
        market.bet(IPaperBetMarket.Side.NO, 20e6);
        vm.stopPrank();

        vm.prank(bob);
        collateral.approve(address(market), type(uint256).max);
        vm.prank(bob);
        market.bet(IPaperBetMarket.Side.NO, 280e6); // yesPool=100, noPool=300

        vm.warp(block.timestamp + 2 hours + 1);
        market.resolve(_report(5084e8, uint64(block.timestamp)), "");

        vm.prank(alice);
        market.claimPayout();
        vm.prank(alice);
        (uint256 realizedLoss, uint256 paperMinted) = market.claimLossReward();

        assertEq(realizedLoss, 0, "net-profitable wallet has zero realized loss despite a losing side");
        assertEq(paperMinted, 0, "net-profitable wallet mints zero PAPER");
    }

    /// Brief §52 Invariant 3/4 — each claim is one-time per (market, address).
    function test_DoubleClaim_Reverts() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 0, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 100e6);
        vm.stopPrank();
        vm.startPrank(bob);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.NO, 100e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours + 1);
        market.resolve(_report(5084e8, uint64(block.timestamp)), "");

        vm.prank(alice);
        market.claimPayout();
        vm.prank(alice);
        vm.expectRevert(bytes("Market: already claimed"));
        market.claimPayout();

        vm.prank(bob);
        market.claimLossReward();
        vm.prank(bob);
        vm.expectRevert(bytes("Market: already claimed"));
        market.claimLossReward();
    }

    /// Brief §34/§35 — an empty-sided pool cancels instead of settling into
    /// divide-by-zero math, and a cancelled market refunds the exact stake.
    function test_EmptyPool_CancelsAndRefunds() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 200, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        market.bet(IPaperBetMarket.Side.YES, 50e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours + 1);
        market.resolve(_report(5084e8, uint64(block.timestamp)), "");

        assertEq(uint8(market.status()), uint8(IPaperBetMarket.MarketStatus.CANCELLED));

        uint256 balanceBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = market.claimPayout();
        assertEq(refund, 50e6, "exact refund, no fee");
        assertEq(collateral.balanceOf(alice), balanceBefore + 50e6);
    }

    /// Brief §38 — pause blocks new bets and new market creation.
    function test_Pause_BlocksBetAndCreate() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 0, 1e6, 1_000_000e6);

        vm.prank(admin);
        pause.setPaused(true);

        vm.expectRevert();
        _createMarket(0, 1 hours, 2 hours, 0, 1e6, 1_000_000e6);

        vm.warp(block.timestamp + 1);
        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        vm.expectRevert(bytes("Market: protocol paused"));
        market.bet(IPaperBetMarket.Side.YES, 1e6);
        vm.stopPrank();

        vm.prank(admin);
        pause.setPaused(false);
        vm.prank(alice);
        market.bet(IPaperBetMarket.Side.YES, 1e6); // now succeeds
    }

    /// Brief §59 — bet bounds enforced.
    function test_BetBounds_Enforced() public {
        PaperBetMarket market = _createMarket(0, 1 hours, 2 hours, 0, 10e6, 20e6);
        vm.warp(block.timestamp + 1);

        vm.startPrank(alice);
        collateral.approve(address(market), type(uint256).max);
        vm.expectRevert(bytes("Market: amount out of bounds"));
        market.bet(IPaperBetMarket.Side.YES, 5e6);
        vm.expectRevert(bytes("Market: amount out of bounds"));
        market.bet(IPaperBetMarket.Side.YES, 25e6);
        vm.stopPrank();
    }
}
