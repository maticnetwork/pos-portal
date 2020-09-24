pragma solidity 0.6.6;


import {AccessControlMixin} from "../common/AccessControlMixin.sol";

/**
* @notice Mock child tunnel contract to receive and send message from L2
*/
abstract contract BaseChildTunnel is AccessControlMixin {
    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

    // MessageTunnel on L1 will get data from this event
    event MessageSent(bytes message);

    constructor() internal {
      _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
      _setupRole(STATE_SYNCER_ROLE, 0x0000000000000000000000000000000000001001);
      _setupContractId("ChildTunnel");
    }

    /**
     * @notice Receive state sync from matic contracts
     * @dev This method will be called by Matic chain internally.
     * This is executed without transaction using a system call.
     */
    function onStateReceive(uint256, bytes memory message) public only(STATE_SYNCER_ROLE) {
        _processMessageFromRoot(message);
    }

    /**
     * @notice Emit message that can be received on Root Tunnel
     * @dev Call the internal function when need to emit message
     * @param message bytes message that will be sent to Root Tunnel
     * some message examples -
     *   abi.encode(tokenId);
     *   abi.encode(tokenId, tokenMetadata);
     *   abi.encode(messageType, messageData);
     */
    function _sendMessageToRoot(bytes memory message) internal {
        emit MessageSent(message);
    }

    /**
     * @notice Process message received from Root Tunnel
     * @dev function needs to be implemented to handle message as per requirement
     * This is called by onStateReceive function.
     * Since it is called via a system call, any event will not be emitted during its execution.
     * @param message bytes message that was sent from Root Tunnel
     */
    function _processMessageFromRoot(bytes memory message) virtual internal;
}
