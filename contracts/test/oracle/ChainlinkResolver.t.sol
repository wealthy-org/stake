// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ChainlinkDataStreamsResolver, IVerifierProxy} from "../../src/oracle/ChainlinkDataStreamsResolver.sol";

/// @notice Mock verifier proxy simulating official Chainlink Data Streams VerifierProxy
contract MockVerifierProxy is IVerifierProxy {
    bytes public mockedResponse;
    bool public shouldRevert;

    function setMockResponse(bytes memory response) external {
        mockedResponse = response;
    }

    function setShouldRevert(bool revert_) external {
        shouldRevert = revert_;
    }

    function verify(bytes calldata, bytes calldata) external payable returns (bytes memory) {
        if (shouldRevert) {
            revert("VerifierProxy: invalid signatures or unverified feed");
        }
        return mockedResponse;
    }
}

contract ChainlinkDataStreamsResolverTest is Test {
    MockVerifierProxy mockProxy;
    ChainlinkDataStreamsResolver resolver;

    function setUp() public {
        vm.warp(1_700_000_000);
        mockProxy = new MockVerifierProxy();
        resolver = new ChainlinkDataStreamsResolver(address(mockProxy));
    }

    function test_VerifyAndResolve_ValidReport() public {
        // Report V3 with 18 decimal price: 5,000 * 1e18
        int192 rawPrice = 5000 * 1e18;
        uint32 obsTime = uint32(block.timestamp);

        ChainlinkDataStreamsResolver.ReportV3 memory report = ChainlinkDataStreamsResolver.ReportV3({
            feedId: keccak256("ETH-USD-FEED"),
            validFromTimestamp: uint32(block.timestamp - 10),
            observationsTimestamp: obsTime,
            nativeFee: 0,
            linkFee: 0,
            expiresAt: uint32(block.timestamp + 300),
            price: rawPrice,
            bid: rawPrice,
            ask: rawPrice
        });

        mockProxy.setMockResponse(abi.encode(report));

        (uint256 price, uint64 observedAt) = resolver.verifyAndResolve("dummy_report", "");

        // Converted from 1e18 to 1e8 price scale for PaperBetMarket
        assertEq(price, 5000e8, "Price scaling mismatch");
        assertEq(observedAt, uint64(obsTime), "Observation timestamp mismatch");
    }

    function test_VerifyAndResolve_RevertsOnNegativeOrZeroPrice() public {
        ChainlinkDataStreamsResolver.ReportV3 memory report = ChainlinkDataStreamsResolver.ReportV3({
            feedId: keccak256("ETH-USD-FEED"),
            validFromTimestamp: uint32(block.timestamp - 10),
            observationsTimestamp: uint32(block.timestamp),
            nativeFee: 0,
            linkFee: 0,
            expiresAt: uint32(block.timestamp + 300),
            price: 0, // non-positive
            bid: 0,
            ask: 0
        });

        mockProxy.setMockResponse(abi.encode(report));

        vm.expectRevert("ChainlinkDataStreamsResolver: non-positive price");
        resolver.verifyAndResolve("dummy_report", "");
    }

    function test_VerifyAndResolve_PropagatesVerifierRevert() public {
        mockProxy.setShouldRevert(true);

        vm.expectRevert("VerifierProxy: invalid signatures or unverified feed");
        resolver.verifyAndResolve("invalid_report", "");
    }
}
