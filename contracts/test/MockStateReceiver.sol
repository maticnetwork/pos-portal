// SPDX-License-Identifier: MIT
pragma solidity 0.6.6;

import {IStateReceiver} from "../child/IStateReceiver.sol";

/**
 * @title StateReceiver
 */
contract MockStateReceiver {
    IStateReceiver public childTunnel;

    function setChildTunnel(address _childTunnel) external {
        childTunnel = IStateReceiver(_childTunnel);
    }

    function receiveState(uint256 stateId, bytes calldata _data) external {
        childTunnel.onStateReceive(stateId, _data);
    }
}
