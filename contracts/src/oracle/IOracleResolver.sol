// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Oracle adapter interface (brief §24) — PaperBetMarket calls through
/// this, never a specific provider's verifier directly, so the provider can
/// be swapped (e.g. ChainlinkDataStreamsResolver) without touching the market.
interface IOracleResolver {
    /// @param report Provider-specific signed report payload (e.g. a Chainlink
    /// Data Streams fullReport blob) to be cryptographically verified.
    /// @param extraData Provider-specific extra data (e.g. fee-token encoding).
    /// @return price The verified price, scaled 1e8 (matches strikePrice scale).
    /// @return observationTimestamp The report's observation time (unix seconds).
    function verifyAndResolve(bytes calldata report, bytes calldata extraData)
        external
        returns (uint256 price, uint64 observationTimestamp);
}
