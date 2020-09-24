pragma solidity 0.6.6;

import {BaseRootTunnel} from "../tunnel/BaseRootTunnel.sol";

contract TestRootTunnel is BaseRootTunnel {
    uint256 public receivedNumber;

    event MessageReceivedFromChild(uint256);

    function _processMessageFromChild(bytes memory message) internal override {
        (uint256 n) = abi.decode(message, (uint256));
        emit MessageReceivedFromChild(n);
        receivedNumber = n;
    }
}
