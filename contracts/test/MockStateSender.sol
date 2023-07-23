// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

import {IStateSender} from "../root/StateSender/IStateSender.sol";

interface IStateReceiver {
    function onStateReceive(uint256 stateId, bytes calldata data) external;
}

/**
 * @title StastateteSender
 */
contract MockStateSender is IStateSender {
    uint256 public stateId;

    function syncState(
        address receiver,
        bytes calldata data
    ) external override {
        IStateReceiver(receiver).onStateReceive(stateId++, data);
    }
}
