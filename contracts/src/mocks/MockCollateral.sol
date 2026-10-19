// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for USDG in tests — mintable by anyone, 6 decimals to
/// match the brief's assumed collateral precision (verify USDG's real
/// decimals before mainnet, brief §18).
contract MockCollateral is ERC20 {
    constructor() ERC20("Mock USDG", "mUSDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
