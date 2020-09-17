pragma solidity 0.6.6;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
* @notice Mock child tunnel contract to receive and send message from L2
*/
contract ChildTunnel is AccessControl {
    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");
    bytes32 public constant CHILD_SENDER_ROLE = keccak256("CHILD_SENDER_ROLE");

    bytes32 public constant MSG1 = keccak256("MSG1");
    bytes32 public constant MSG2 = keccak256("MSG2");

    // MessageTunnel on L1 will get data from this event
    event SendMessage(bytes);

    // This method will be called by Matic chain internally, without transaction. 
    // It's called `system-call`.
    // It won't generate any event log since it's not a transaction based state change.
    function receiveMessage(uint256, bytes calldata data) public only(STATE_SYNCER_ROLE) {
        (bytes32 syncType, bytes memory syncData) = abi.decode(
            data,
            (bytes32, bytes)
        );

        if (syncType == MSG1) {
            // process syncData according to MSG1
        } else if (syncType == MSG2) {
            // process syncData according to MSG2
        }

        // ignore any other type
    }

    // Send message from L2 to L1
    function sendMessage(bytes calldata data) public only(CHILD_SENDER_ROLE) {
        emit SendMessage(data);
    }
}
