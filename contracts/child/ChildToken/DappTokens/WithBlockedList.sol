// SPDX-License-Identifier: Apache 2.0

pragma solidity 0.6.6;

import {AccessControlMixin} from "../../../common/AccessControlMixin.sol";

/*

   Copyright Tether.to 2020

   Author Will Harborne

   Licensed under the Apache License, Version 2.0
   http://www.apache.org/licenses/LICENSE-2.0

*/


contract WithBlockedList is AccessControlMixin {

    bytes32 public constant BLOCK_ROLE = keccak256("BLOCK_ROLE");

    function _initializeBlockedList(address admin) internal {
        _setupRole(BLOCK_ROLE, admin);
    }

    /**
     * @dev Reverts if called by a blocked account
     */
    modifier onlyNotBlocked() {
      require(!isBlocked[_msgSender()], "Blocked: msg.sender is blocked");
      _;
    }

    mapping (address => bool) public isBlocked;

    function addToBlockedList (address _user) public only(BLOCK_ROLE) {
        isBlocked[_user] = true;
        emit BlockPlaced(_user);
    }

    function removeFromBlockedList (address _user) public only(BLOCK_ROLE) {
        isBlocked[_user] = false;
        emit BlockReleased(_user);
    }

    event BlockPlaced(address indexed _user);

    event BlockReleased(address indexed _user);
    
    uint256[50] private __gap;
}
