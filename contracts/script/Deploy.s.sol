// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {PaperToken} from "../src/PaperToken.sol";
import {EmissionController} from "../src/EmissionController.sol";
import {ProtocolPause} from "../src/ProtocolPause.sol";
import {FeeTreasury} from "../src/FeeTreasury.sol";
import {PaperBetFactory} from "../src/PaperBetFactory.sol";
import {PaperBetMarket} from "../src/PaperBetMarket.sol";

/// @notice Deploys the full stack to whichever network RPC/key the `forge
/// script` invocation points at. Run with --rpc-url robinhood_testnet
/// (foundry.toml alias) once ROBINHOOD_TESTNET_RPC_URL is set, and
/// PRIVATE_KEY / ADMIN_ADDRESS / COLLATERAL_TOKEN / ORACLE_RESOLVER are set
/// in the environment (see contracts/.env.example). Never pass a private
/// key on the command line — always via an env var or --account (keystore).
contract Deploy is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address collateralToken = vm.envAddress("COLLATERAL_TOKEN");
        // Oracle resolver: for a first testnet pass, deploy MockOracleResolver
        // separately and pass its address here. Swap to
        // ChainlinkDataStreamsResolver only after the brief §24 unresolved
        // items (fee-token encoding, report struct, verifier address) are
        // confirmed — see src/oracle/ChainlinkDataStreamsResolver.sol's NatSpec.
        address oracleResolver = vm.envAddress("ORACLE_RESOLVER");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        PaperToken paper = new PaperToken(admin);
        EmissionController emission = new EmissionController(admin, paper);
        ProtocolPause pause = new ProtocolPause(admin);
        FeeTreasury treasury = new FeeTreasury(admin);
        PaperBetMarket implementation = new PaperBetMarket();

        PaperBetFactory factory = new PaperBetFactory(
            admin, address(implementation), collateralToken, oracleResolver, emission, address(treasury), pause
        );

        // Grant the minimal roles each contract needs from the other —
        // see brief §37's "admin configures the protocol" boundary. None of
        // these grant mint/pause/cancel authority to anyone but `admin` and
        // the specific contracts that need it to function.
        paper.grantRole(paper.EMISSION_ROLE(), address(emission));
        emission.grantRole(emission.FACTORY_ROLE(), address(factory));

        vm.stopBroadcast();

        console.log("PaperToken:        ", address(paper));
        console.log("EmissionController:", address(emission));
        console.log("ProtocolPause:     ", address(pause));
        console.log("FeeTreasury:       ", address(treasury));
        console.log("Market implementation:", address(implementation));
        console.log("PaperBetFactory:   ", address(factory));
    }
}
