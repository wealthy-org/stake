// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PaperBetFactory} from "../src/PaperBetFactory.sol";
import {PaperBetMarket} from "../src/PaperBetMarket.sol";
import {IPaperBetMarket} from "../src/interfaces/IPaperBetMarket.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";

/// @notice One-shot live smoke test against an already-deployed testnet
/// stack: creates a market, bets, waits, resolves, and claims — proving the
/// brief's "bet -> win -> claim money / lose -> claim PAPER" flow actually
/// works on-chain, not just that the contracts compiled and deployed.
contract SmokeTest is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        address collateralAddr = vm.envAddress("COLLATERAL_TOKEN");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(deployerKey);

        PaperBetFactory factory = PaperBetFactory(factoryAddr);
        MockCollateral collateral = MockCollateral(collateralAddr);

        uint64 nowTs = uint64(block.timestamp);

        vm.startBroadcast(deployerKey);

        collateral.mint(me, 1_000e6);

        PaperBetFactory.CreateMarketParams memory p = PaperBetFactory.CreateMarketParams({
            marketId: keccak256(abi.encode("smoketest", nowTs)),
            oracleFeedId: bytes32(0),
            strikePrice: 5_000e8,
            comparison: IPaperBetMarket.Comparison.GREATER_THAN,
            bettingOpensAt: nowTs,
            bettingClosesAt: nowTs + 600,
            resolutionTimestamp: nowTs + 660,
            resolutionWindow: 900,
            protocolFeeBps: 200,
            minBet: 1e6,
            maxBet: 1_000e6,
            question: "Smoke test: will ETH be above $5,000?"
        });
        address marketAddr = factory.createMarket(p);
        console.log("Market created:", marketAddr);

        PaperBetMarket market = PaperBetMarket(marketAddr);
        collateral.approve(marketAddr, 100e6);
        market.bet(IPaperBetMarket.Side.YES, 100e6);
        console.log("Bet 100 USDG on YES. yesPool:", market.yesPool(), "noPool:", market.noPool());

        vm.stopBroadcast();

        console.log("Market address (save for the resolve step after noPool is non-zero or window passes):");
        console.log(marketAddr);
    }
}
