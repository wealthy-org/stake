// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IEmissionController} from "./interfaces/IEmissionController.sol";
import {PaperToken} from "./PaperToken.sol";
import {EmissionMath} from "./libraries/EmissionMath.sol";

/// @title EmissionController
/// @notice The only contract allowed to mint PAPER (brief §15). Markets
/// register as MARKET_ROLE to call claimLossReward; the admin role manages
/// which markets are registered but never mints or bypasses the net-loss
/// calculation itself — that happens in PaperBetMarket before this is called.
contract EmissionController is AccessControl, IEmissionController {
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");
    /// @dev Minimal-privilege role: can ONLY register new markets as
    /// MARKET_ROLE, nothing else — so PaperBetFactory doesn't need (and
    /// never gets) DEFAULT_ADMIN_ROLE here.
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @dev Genesis milestone (brief §14) — TESTNET-ONLY placeholder, product
    /// owner must finalize before mainnet (brief §75). $100,000 cumulative
    /// realized loss, matching the brief's own example list in §14.
    uint256 public constant GENESIS_MILESTONE_LOSS = 100_000 * EmissionMath.DOLLAR;

    PaperToken public immutable paperToken;

    uint256 public cumulativeRealizedLoss;
    uint256 public cumulativePaperMinted;

    /// @dev One claim per (market, user) — mirrors the DB-ledger phase's
    /// `positions.loss_reward_claimed` flag, enforced here instead.
    mapping(bytes32 => mapping(address => bool)) public lossClaimed;

    event LossRewardClaimed(
        bytes32 indexed marketId,
        address indexed user,
        uint256 realizedLoss,
        uint256 paperMinted,
        uint256 cumulativeRealizedLoss,
        uint256 cumulativePaperMinted
    );

    constructor(address admin, PaperToken _paperToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        paperToken = _paperToken;
    }

    /// @notice Registers a freshly deployed market clone as MARKET_ROLE.
    /// Only callable by FACTORY_ROLE, and that's the only thing FACTORY_ROLE
    /// can do — it cannot grant itself other roles or touch supply directly.
    function registerMarket(address market) external onlyRole(FACTORY_ROLE) {
        _grantRole(MARKET_ROLE, market);
    }

    /// @notice Called by a registered market with the user's NET realized
    /// loss (brief §11/§32) — gross losing-side stake must never reach this
    /// function; that distinction is the market contract's job.
    function claimLossReward(bytes32 marketId, address user, uint256 realizedLoss)
        external
        onlyRole(MARKET_ROLE)
        returns (uint256 paperMinted)
    {
        require(!lossClaimed[marketId][user], "EmissionController: already claimed");
        lossClaimed[marketId][user] = true;

        if (realizedLoss == 0) {
            emit LossRewardClaimed(marketId, user, 0, 0, cumulativeRealizedLoss, cumulativePaperMinted);
            return 0;
        }

        paperMinted = EmissionMath.calcEmission(cumulativeRealizedLoss, realizedLoss);

        cumulativeRealizedLoss += realizedLoss;
        cumulativePaperMinted += paperMinted;

        if (paperMinted > 0) {
            paperToken.mintFromLoss(user, paperMinted);
        }

        if (!paperToken.transfersEnabled() && cumulativeRealizedLoss >= GENESIS_MILESTONE_LOSS) {
            paperToken.enableTransfers();
        }

        emit LossRewardClaimed(marketId, user, realizedLoss, paperMinted, cumulativeRealizedLoss, cumulativePaperMinted);
    }

    function previewEmission(uint256 cumulativeLossBefore, uint256 realizedLoss)
        external
        pure
        returns (uint256 paperMinted)
    {
        return EmissionMath.calcEmission(cumulativeLossBefore, realizedLoss);
    }
}
