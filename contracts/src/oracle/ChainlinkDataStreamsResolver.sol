// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IOracleResolver} from "./IOracleResolver.sol";

/// @notice Minimal interface for the Data Streams Verifier Proxy (brief §24/§25).
/// Mainnet address (Robinhood Chain, chain ID 4663) per brief §4:
/// 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7 — TESTNET ADDRESS IS NOT YET
/// CONFIRMED from official docs; look it up on Robinhood Chain's testnet
/// Blockscout before deploying this anywhere. Do not copy an address from
/// this file into a deploy script without that check (brief §4's own warning).
interface IVerifierProxy {
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);
}

/// @title ChainlinkDataStreamsResolver
/// @notice UNVERIFIED SCAFFOLD, not wired into any deployment. The report
/// struct layout below (feedId/validFromTimestamp/observationsTimestamp/
/// nativeFee/linkFee/expiresAt/price/bid/ask) is Chainlink's commonly
/// documented crypto "Report V3" shape, but it has NOT been confirmed
/// against the live chainlink contracts npm package or Robinhood Chain's
/// actual feed configuration for this project. Before using this contract:
///   1. Install the official Chainlink contracts package (Data Streams
///      module) and replace the hand-rolled Report struct below with its
///      real one.
///   2. Confirm the fee-token encoding `parameterPayload` must carry
///      (the REST API docs say the fee token must be encoded into the
///      payload before verification, but didn't specify the exact ABI here).
///   3. Confirm whether this chain's VerifierProxy requires LINK/native fee
///      payment per call (fee-manager-based billing) or none (brief §4 says
///      check the official docs; this varies by chain/billing model).
///   4. Get real Data Streams API credentials (self-serve at app.chain.link)
///      for the off-chain keeper that fetches the signed `fullReport` this
///      contract expects as `report`.
contract ChainlinkDataStreamsResolver is IOracleResolver {
    IVerifierProxy public immutable verifierProxy;

    struct ReportV3 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 price;
        int192 bid;
        int192 ask;
    }

    constructor(address verifierProxy_) {
        verifierProxy = IVerifierProxy(verifierProxy_);
    }

    /// @param report The signed `fullReport` blob fetched off-chain from the
    /// Data Streams REST API (GET /api/v1/reports) for this market's feed.
    /// @param extraData Fee-token encoding to pass as `parameterPayload` —
    /// shape NOT yet confirmed, see contract-level NatSpec.
    function verifyAndResolve(bytes calldata report, bytes calldata extraData)
        external
        returns (uint256 price, uint64 observationTimestamp)
    {
        bytes memory verified = verifierProxy.verify(report, extraData);
        ReportV3 memory r = abi.decode(verified, (ReportV3));

        require(r.price > 0, "ChainlinkDataStreamsResolver: non-positive price");
        // Data Streams crypto reports are commonly 18-decimal; this contract's
        // callers (PaperBetMarket) assume an 8-decimal price scale to match
        // strikePrice. VERIFY the real decimals for this feed before use.
        price = uint256(int256(r.price)) / 1e10;
        observationTimestamp = r.observationsTimestamp;
    }
}
