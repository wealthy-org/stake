// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PaperToken
/// @notice ERC-20 with zero initial supply (brief §13.2). The only way supply
/// is ever created is EMISSION_ROLE calling mintFromLoss — never the admin,
/// never a premint, never a team/VC/airdrop allocation (brief §13.3, §78).
/// Non-upgradeable by design (brief §13.4): "only losses can create supply"
/// is a weaker claim if the mint logic could be swapped out from under it.
contract PaperToken is ERC20, AccessControl {
    bytes32 public constant EMISSION_ROLE = keccak256("EMISSION_ROLE");

    /// @dev Transfer lock / genesis phase (brief §14). Starts false and can
    /// only ever move false -> true, enforced in _update below. No function
    /// in this contract can set it back to false once enabled.
    bool public transfersEnabled;

    event TransfersEnabled();

    constructor(address admin) ERC20("Paper", "PAPER") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mints PAPER against a verified net realized loss. Only ever
    /// called by the EmissionController (brief §13.3) — the admin role here
    /// manages *roles*, not minting, and cannot call this directly unless
    /// also granted EMISSION_ROLE, which production deployment must never do.
    function mintFromLoss(address to, uint256 amount) external onlyRole(EMISSION_ROLE) {
        _mint(to, amount);
    }

    /// @notice One-way genesis-complete switch (brief §14). Restricted to
    /// EMISSION_ROLE because the EmissionController is the contract that
    /// knows whether the milestone (cumulative realized loss, bettor count,
    /// or timestamp — brief §75, still TBD) has been reached; the admin role
    /// cannot call this directly for the same reason it cannot mint.
    function enableTransfers() external onlyRole(EMISSION_ROLE) {
        if (transfersEnabled) return;
        transfersEnabled = true;
        emit TransfersEnabled();
    }

    /// @dev Blocks transfers until genesis completes. Minting (from == address(0))
    /// is always allowed — the lock is on moving PAPER between holders, not on
    /// losses creating it. Burning (to == address(0)) is also always allowed.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(transfersEnabled, "PaperToken: transfers locked until genesis completes");
        }
        super._update(from, to, value);
    }
}
