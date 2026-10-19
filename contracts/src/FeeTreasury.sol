// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeTreasury
/// @notice Collects protocol fees (brief §36). Deploy with a 2-of-3 Safe (or
/// similar multisig) as `admin` — this contract itself has no multisig logic,
/// it just restricts withdrawal to whoever holds TREASURY_ROLE.
contract FeeTreasury is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
    }

    /// @dev Markets transfer fees here directly via SafeERC20; no deposit
    /// function needed. Winner payouts never depend on this contract's
    /// balance (brief §36 — "do not make winner payouts dependent on
    /// treasury liquidity"), since each market escrows its own collateral.
    function withdraw(IERC20 token, address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount);
    }
}
