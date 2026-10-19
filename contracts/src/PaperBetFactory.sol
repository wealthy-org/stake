// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {PaperBetMarket} from "./PaperBetMarket.sol";
import {IPaperBetMarket} from "./interfaces/IPaperBetMarket.sol";
import {EmissionController} from "./EmissionController.sol";
import {ProtocolPause} from "./ProtocolPause.sol";

/// @title PaperBetFactory
/// @notice Creates markets from an approved implementation via EIP-1167
/// minimal proxy clones (brief §19/§20). Market creation is restricted to
/// MARKET_CREATOR_ROLE — brief explicitly excludes permissionless market
/// creation from V1 ("Do Not Include in V1" / brief §20 reasons: oracle
/// configuration, legal risk, malformed markets, spam).
contract PaperBetFactory is AccessControl {
    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");

    /// @dev Versioned implementations (brief §60) — old markets keep using
    /// whatever implementation they were cloned from; only NEW markets pick
    /// up a newly approved version.
    address public currentImplementation;
    mapping(address => bool) public approvedImplementation;

    address public immutable collateralToken;
    address public immutable oracleResolver;
    EmissionController public immutable emissionController;
    address public immutable feeTreasury;
    ProtocolPause public immutable protocolPause;

    uint16 public constant MAX_PROTOCOL_FEE_BPS = 500; // brief §58, hard cap

    address[] public allMarkets;

    event MarketCreated(bytes32 indexed marketId, address indexed market, string question);
    event ImplementationApproved(address implementation);

    constructor(
        address admin,
        address implementation,
        address collateralToken_,
        address oracleResolver_,
        EmissionController emissionController_,
        address feeTreasury_,
        ProtocolPause protocolPause_
    ) {
        require(admin != address(0), "Factory: admin is zero");
        require(implementation != address(0), "Factory: implementation is zero");
        require(collateralToken_ != address(0), "Factory: collateralToken is zero");
        require(oracleResolver_ != address(0), "Factory: oracleResolver is zero");
        require(address(emissionController_) != address(0), "Factory: emissionController is zero");
        require(feeTreasury_ != address(0), "Factory: feeTreasury is zero");
        require(address(protocolPause_) != address(0), "Factory: protocolPause is zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MARKET_CREATOR_ROLE, admin);

        approvedImplementation[implementation] = true;
        currentImplementation = implementation;
        emit ImplementationApproved(implementation);

        collateralToken = collateralToken_;
        oracleResolver = oracleResolver_;
        emissionController = emissionController_;
        feeTreasury = feeTreasury_;
        protocolPause = protocolPause_;
    }

    function approveImplementation(address implementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(implementation != address(0), "Factory: implementation is zero");
        approvedImplementation[implementation] = true;
        currentImplementation = implementation;
        emit ImplementationApproved(implementation);
    }

    struct CreateMarketParams {
        bytes32 marketId;
        bytes32 oracleFeedId;
        uint256 strikePrice;
        IPaperBetMarket.Comparison comparison;
        uint64 bettingOpensAt;
        uint64 bettingClosesAt;
        uint64 resolutionTimestamp;
        uint64 resolutionWindow;
        uint16 protocolFeeBps;
        uint256 minBet;
        uint256 maxBet;
        string question;
    }

    /// @dev Validates the same bounds as brief §59 before ever deploying a clone.
    function createMarket(CreateMarketParams calldata p) external onlyRole(MARKET_CREATOR_ROLE) returns (address market) {
        require(!protocolPause.paused(), "Factory: protocol paused");
        require(p.bettingOpensAt < p.bettingClosesAt, "Factory: opens must be before closes");
        require(p.bettingClosesAt <= p.resolutionTimestamp, "Factory: closes must be <= resolution");
        require(p.resolutionWindow > 0, "Factory: resolutionWindow must be > 0");
        require(p.strikePrice > 0, "Factory: strikePrice must be > 0");
        require(p.protocolFeeBps <= MAX_PROTOCOL_FEE_BPS, "Factory: fee exceeds max");
        require(p.minBet > 0, "Factory: minBet must be > 0");
        require(p.maxBet >= p.minBet, "Factory: maxBet must be >= minBet");
        require(bytes(p.question).length > 0, "Factory: question must not be empty");

        market = Clones.clone(currentImplementation);

        PaperBetMarket(market).initialize(
            p.marketId,
            collateralToken,
            oracleResolver,
            address(emissionController),
            feeTreasury,
            p.oracleFeedId,
            p.strikePrice,
            p.comparison,
            p.bettingOpensAt,
            p.bettingClosesAt,
            p.resolutionTimestamp,
            p.resolutionWindow,
            p.protocolFeeBps,
            p.minBet,
            p.maxBet
        );
        PaperBetMarket(market).setProtocolPause(address(protocolPause));
        emissionController.registerMarket(market);

        allMarkets.push(market);
        emit MarketCreated(p.marketId, market, p.question);
    }

    function marketCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
