pragma solidity 0.6.6;


import {AccessControlMixin} from "../common/AccessControlMixin.sol";

/**
* @notice Mock child tunnel contract to receive and send message from L2
*/
abstract contract BaseChildTunnel is AccessControlMixin {
    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");
    bytes32 public constant CHILD_SENDER_ROLE = keccak256("CHILD_SENDER_ROLE");

    // MessageTunnel on L1 will get data from this event
    event SendMessage(bytes);

    // This method will be called by Matic chain internally, without transaction. 
    // It's called `system-call`.
    // It won't generate any event log since it's not a transaction based state change.
    function onStateReceive(uint256, bytes memory data) public only(STATE_SYNCER_ROLE) {
        processMessage(data);
    }

    // Send message from L2 to L1
    function sendMessage(bytes memory data) public only(CHILD_SENDER_ROLE) {
        emit SendMessage(data);
    }

    // process message
    function processMessage(bytes memory message) virtual internal;
}
