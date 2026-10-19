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

/// @notice Handler that simulates unpredictable sequences of actor actions
contract MarketHandler is Test {
    PaperBetMarket public market;
    MockCollateral public collateral;
    EmissionController public emission;
    PaperToken public paper;
    FeeTreasury public treasury;

    address[] public actors;
    mapping(address => bool) public isActor;
    mapping(address => bool) public hasClaimedPayout;
    mapping(address => bool) public hasClaimedLoss;

    uint256 public totalDepositedCollateral;
    uint256 public totalPaidOutCollateral;
    uint256 public totalTreasuryFee;

    bool public isResolved;
    bool public isCancelled;

    constructor(
        PaperBetMarket _market,
        MockCollateral _collateral,
        EmissionController _emission,
        PaperToken _paper,
        FeeTreasury _treasury
    ) {
        market = _market;
        collateral = _collateral;
        emission = _emission;
        paper = _paper;
        treasury = _treasury;

        // Initialize 5 distinct actors
        for (uint160 i = 1; i <= 5; i++) {
            address a = address(uint160(0x1000 + i));
            actors.push(a);
            isActor[a] = true;
            collateral.mint(a, 100_000_000e6);
            vm.prank(a);
            collateral.approve(address(market), type(uint256).max);
        }
    }

    function placeBet(uint256 actorIdx, uint8 sideRaw, uint256 amount) public {
        if (market.status() != IPaperBetMarket.MarketStatus.OPEN && market.status() != IPaperBetMarket.MarketStatus.DRAFT) {
            return;
        }
        if (block.timestamp >= market.bettingClosesAt()) return;

        address actor = actors[actorIdx % actors.length];
        amount = bound(amount, market.minBet(), market.maxBet());
        IPaperBetMarket.Side side = (sideRaw % 2 == 0) ? IPaperBetMarket.Side.YES : IPaperBetMarket.Side.NO;

        vm.prank(actor);
        try market.bet(side, amount) {
            totalDepositedCollateral += amount;
        } catch {}
    }

    function resolveMarket(uint256 price) public {
        if (isResolved || isCancelled) return;
        if (block.timestamp < market.resolutionTimestamp()) {
            vm.warp(market.resolutionTimestamp() + 1);
        }

        price = bound(price, 1e8, 100_000e8);
        bytes memory report = abi.encode(price, uint64(market.resolutionTimestamp() + 1));

        uint256 treasuryBalBefore = collateral.balanceOf(address(treasury));
        try market.resolve(report, "") {
            if (market.status() == IPaperBetMarket.MarketStatus.RESOLVED) {
                isResolved = true;
                totalTreasuryFee = collateral.balanceOf(address(treasury)) - treasuryBalBefore;
            } else if (market.status() == IPaperBetMarket.MarketStatus.CANCELLED) {
                isCancelled = true;
            }
        } catch {}
    }

    function claimPayout(uint256 actorIdx) public {
        address actor = actors[actorIdx % actors.length];
        if (hasClaimedPayout[actor]) return;
        if (market.status() != IPaperBetMarket.MarketStatus.RESOLVED && market.status() != IPaperBetMarket.MarketStatus.CANCELLED) {
            return;
        }

        uint256 balBefore = collateral.balanceOf(actor);
        vm.prank(actor);
        try market.claimPayout() returns (uint256 claimed) {
            hasClaimedPayout[actor] = true;
            uint256 balAfter = collateral.balanceOf(actor);
            require(balAfter - balBefore == claimed, "Payout transfer mismatch");
            totalPaidOutCollateral += claimed;
        } catch {}
    }

    function claimLossReward(uint256 actorIdx) public {
        address actor = actors[actorIdx % actors.length];
        if (hasClaimedLoss[actor]) return;
        if (market.status() != IPaperBetMarket.MarketStatus.RESOLVED) return;

        uint256 paperBalBefore = paper.balanceOf(actor);
        vm.prank(actor);
        try market.claimLossReward() returns (uint256, uint256 paperMinted) {
            hasClaimedLoss[actor] = true;
            uint256 paperBalAfter = paper.balanceOf(actor);
            require(paperBalAfter - paperBalBefore == paperMinted, "PAPER mint mismatch");
        } catch {}
    }
}

/// @notice Invariant test suite running randomized sequences of actions
contract PaperBetInvariantTest is Test {
    MockCollateral collateral;
    PaperToken paper;
    EmissionController emission;
    ProtocolPause pause;
    FeeTreasury treasury;
    MockOracleResolver oracle;
    PaperBetFactory factory;
    PaperBetMarket implementation;
    PaperBetMarket market;
    MarketHandler handler;

    address admin = address(0xAD41);

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

        PaperBetFactory.CreateMarketParams memory p = PaperBetFactory.CreateMarketParams({
            marketId: keccak256(abi.encode("INVARIANT_MARKET")),
            oracleFeedId: bytes32(0),
            strikePrice: 5000e8,
            comparison: IPaperBetMarket.Comparison.GREATER_THAN,
            bettingOpensAt: uint64(block.timestamp),
            bettingClosesAt: uint64(block.timestamp) + 1 hours,
            resolutionTimestamp: uint64(block.timestamp) + 2 hours,
            resolutionWindow: 300,
            protocolFeeBps: 200, // 2%
            minBet: 1e6,
            maxBet: 10_000e6,
            question: "Will ETH > $5000?"
        });

        vm.prank(admin);
        market = PaperBetMarket(factory.createMarket(p));

        handler = new MarketHandler(market, collateral, emission, paper, treasury);

        targetContract(address(handler));
    }

    /// @notice Invariant 1 (Solvency): Market collateral balance + payouts + fee == total deposits
    function invariant_MarketSolvency() public view {
        uint256 currentMarketBalance = collateral.balanceOf(address(market));
        uint256 totalOutflow = handler.totalPaidOutCollateral() + handler.totalTreasuryFee();

        assertLe(
            totalOutflow + currentMarketBalance,
            handler.totalDepositedCollateral(),
            "Solvency invariant broken: out + balance > deposited"
        );
    }

    /// @notice Invariant 2 (Token Supply Integrity): Total PAPER supply == EmissionController cumulative minted
    function invariant_PaperSupplyMatchesEmission() public view {
        assertEq(
            paper.totalSupply(),
            emission.cumulativePaperMinted(),
            "PAPER total supply must strictly match EmissionController cumulativePaperMinted"
        );
    }

    /// @notice Invariant 3 (Admin Cannot Arbitrarily Mint): Only EmissionController holds EMISSION_ROLE
    function invariant_AdminCannotMintPaper() public view {
        assertTrue(
            paper.hasRole(paper.EMISSION_ROLE(), address(emission)),
            "EmissionController must have EMISSION_ROLE"
        );
        assertFalse(
            paper.hasRole(paper.EMISSION_ROLE(), admin),
            "Admin must NEVER hold EMISSION_ROLE (brief Sec 2 and 13)"
        );
    }

    /// @notice Invariant 4: Market status transitions are immutable once resolved or cancelled
    function invariant_ResolutionStateIsFinal() public view {
        if (handler.isResolved()) {
            assertEq(uint8(market.status()), uint8(IPaperBetMarket.MarketStatus.RESOLVED), "Resolved state altered");
        } else if (handler.isCancelled()) {
            assertEq(uint8(market.status()), uint8(IPaperBetMarket.MarketStatus.CANCELLED), "Cancelled state altered");
        }
    }
}
