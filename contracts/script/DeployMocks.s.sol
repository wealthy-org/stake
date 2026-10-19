// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";
import {MockOracleResolver} from "../src/mocks/MockOracleResolver.sol";

/// @notice Deploys MockCollateral + MockOracleResolver for a first testnet
/// pass, before the real USDG address (brief §18) and
/// ChainlinkDataStreamsResolver (brief §24) are confirmed and wired in.
/// Run this first, then feed the printed addresses into Deploy.s.sol's
/// COLLATERAL_TOKEN / ORACLE_RESOLVER env vars.
contract DeployMocks is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        MockCollateral collateral = new MockCollateral();
        MockOracleResolver oracle = new MockOracleResolver();
        vm.stopBroadcast();

        console.log("MockCollateral (mUSDG):", address(collateral));
        console.log("MockOracleResolver:    ", address(oracle));
    }
}
