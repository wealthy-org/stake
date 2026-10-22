// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PaperBetFactory} from "../src/PaperBetFactory.sol";
import {IPaperBetMarket} from "../src/interfaces/IPaperBetMarket.sol";

/// @notice Deploys one real market clone via the already-deployed Factory,
/// for the DB-ledger -> on-chain migration pilot. Prints the clone address
/// so it can be written into the `markets.contract_address` column of the
/// one DB row this is standing in for.
contract DeployPilotMarket is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        PaperBetFactory factory = PaperBetFactory(factoryAddr);
        uint64 nowTs = uint64(block.timestamp);

        vm.startBroadcast(deployerKey);

        PaperBetFactory.CreateMarketParams memory p = PaperBetFactory.CreateMarketParams({
            marketId: keccak256(abi.encode("onchain-pilot", nowTs)),
            oracleFeedId: bytes32(0),
            strikePrice: 5_000e8,
            comparison: IPaperBetMarket.Comparison.GREATER_THAN,
            bettingOpensAt: nowTs,
            bettingClosesAt: nowTs + 24 hours,
            resolutionTimestamp: nowTs + 24 hours + 5 minutes,
            resolutionWindow: 900,
            protocolFeeBps: 200,
            minBet: 1e6,
            maxBet: 5_000e6,
            question: "On-chain pilot: Will ETH be above $5,000?"
        });

        address market = factory.createMarket(p);

        vm.stopBroadcast();

        console.log("Pilot market deployed at:", market);
    }
}
