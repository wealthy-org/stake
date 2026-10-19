// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IOracleResolver} from "../oracle/IOracleResolver.sol";

/// @notice Deterministic test double for IOracleResolver. The "report" is
/// just abi.encode(price, observationTimestamp) — no real signature checking,
/// so this must never be wired into anything beyond local/unit tests.
contract MockOracleResolver is IOracleResolver {
    function verifyAndResolve(bytes calldata report, bytes calldata /* extraData */ )
        external
        pure
        returns (uint256 price, uint64 observationTimestamp)
    {
        (price, observationTimestamp) = abi.decode(report, (uint256, uint64));
    }
}
