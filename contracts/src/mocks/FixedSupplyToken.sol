// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for a Pons-launched token: the ENTIRE supply mints once
/// to the deployer at construction, and there is no mint function
/// afterward — same shape as what Pons's bonding curve produces (brief
/// context: fixed 1,000,000,000-token supply, no mint authority left for
/// anyone). Used only to simulate the real thing on testnet, where Pons
/// itself isn't deployed.
contract FixedSupplyToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 totalSupply_) ERC20(name_, symbol_) {
        _mint(msg.sender, totalSupply_);
    }
}
