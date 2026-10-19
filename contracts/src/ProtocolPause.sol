// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ProtocolPause
/// @notice Shared pause switch (brief §38) checked by every market and the
/// factory. Blocks new bets and new market creation; never blocks claims or
/// refunds — nothing here is wired into claim/refund paths by design.
contract ProtocolPause is AccessControl {
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    bool public paused;

    event PausedSet(bool paused);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSE_ROLE, admin);
    }

    function setPaused(bool value) external onlyRole(PAUSE_ROLE) {
        paused = value;
        emit PausedSet(value);
    }
}
