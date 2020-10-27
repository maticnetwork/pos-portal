pragma solidity 0.6.6;

import {BaseChildTunnel} from "../tunnel/BaseChildTunnel.sol";

contract TestChildTunnel is BaseChildTunnel {
    uint256 public number;

    bytes32 public constant TYPE1 = keccak256("TYPE1");
    bytes32 public constant TYPE2 = keccak256("TYPE2");

    function _processMessageFromRoot(bytes memory message) internal override {
        (bytes32 syncType, uint256 n) = abi.decode(
            message,
            (bytes32, uint256)
        );

        if (TYPE1 == syncType) {
            number = number + n; // add
        } else if (TYPE2 == syncType) {
            number = number - n; // sub
        }
    }

    function sendMessage(bytes calldata message) external {
        _sendMessageToRoot(message);
    }
}
