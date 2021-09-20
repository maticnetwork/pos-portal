pragma solidity 0.6.6;


import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {AccessControlMixin} from "../common/AccessControlMixin.sol";
import {IStateSender} from "../root/StateSender/IStateSender.sol";
import {RLPReader} from "../lib/RLPReader.sol";
import {MerklePatriciaProof} from "../lib/MerklePatriciaProof.sol";
import {ICheckpointManager} from "../root/ICheckpointManager.sol";
import {RLPReader} from "../lib/RLPReader.sol";
import {Merkle} from "../lib/Merkle.sol";
import {ExitPayloadReader} from "../lib/ExitPayloadReader.sol";

abstract contract BaseRootTunnel is AccessControlMixin {
    using Merkle for bytes32;
    using SafeMath for uint256;
    using RLPReader for RLPReader.RLPItem;

    using ExitPayloadReader for bytes;
    using ExitPayloadReader for ExitPayloadReader.ExitPayload;
    using ExitPayloadReader for ExitPayloadReader.Log;
    using ExitPayloadReader for ExitPayloadReader.LogTopics;
    using ExitPayloadReader for ExitPayloadReader.Receipt;

    // keccak256(MessageSent(bytes))
    bytes32 public constant SEND_MESSAGE_EVENT_SIG = 0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036;

    // state sender contract
    IStateSender public stateSender;
    // root chain manager
    ICheckpointManager public checkpointManager;
    // child tunnel contract which receives and sends messages 
    address public childTunnel;
    // storage to avoid duplicate exits
    mapping(bytes32 => bool) public processedExits;

    constructor() internal {
      _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
      _setupContractId("RootTunnel");
    }

    /**
     * @notice Set the state sender, callable only by admins
     * @dev This should be the state sender from plasma contracts
     * It is used to send bytes from root to child chain
     * @param newStateSender address of state sender contract
     */
    function setStateSender(address newStateSender)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        require(newStateSender != address(0), "RootTunnel: BAD_NEW_STATE_SENDER");
        stateSender = IStateSender(newStateSender);
    }

    /**
     * @notice Set the checkpoint manager, callable only by admins
     * @dev This should be the plasma contract responsible for keeping track of checkpoints
     * @param newCheckpointManager address of checkpoint manager contract
     */
    function setCheckpointManager(address newCheckpointManager)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        require(newCheckpointManager != address(0), "RootTunnel: BAD_NEW_CHECKPOINT_MANAGER");
        checkpointManager = ICheckpointManager(newCheckpointManager);
    }

    /**
     * @notice Set the child chain tunnel, callable only by admins
     * @dev This should be the contract responsible to receive data bytes on child chain
     * @param newChildTunnel address of child tunnel contract
     */
    function setChildTunnel(address newChildTunnel)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        require(newChildTunnel != address(0x0), "RootTunnel: INVALID_CHILD_TUNNEL_ADDRESS");
        childTunnel = newChildTunnel;
    }

    /**
     * @notice Send bytes message to Child Tunnel
     * @param message bytes message that will be sent to Child Tunnel
     * some message examples -
     *   abi.encode(tokenId);
     *   abi.encode(tokenId, tokenMetadata);
     *   abi.encode(messageType, messageData);
     */
    function _sendMessageToChild(bytes memory message) internal {
        stateSender.syncState(childTunnel, message);
    }

    function _validateAndExtractMessage(bytes memory inputData) internal returns (bytes memory) {    
        ExitPayloadReader.ExitPayload memory payload = inputData.toExitPayload();
        
        bytes memory branchMaskBytes = payload.getBranchMaskAsBytes();
        // checking if exit has already been processed
        // unique exit is identified using hash of (blockNumber, branchMask, receiptLogIndex)
        bytes32 exitHash = keccak256(
            abi.encodePacked(
                payload.getBlockNumber(),
                // first 2 nibbles are dropped while generating nibble array
                // this allows branch masks that are valid but bypass exitHash check (changing first 2 nibbles only)
                // so converting to nibble array and then hashing it
                MerklePatriciaProof._getNibbleArray(branchMaskBytes),
                payload.getReceiptLogIndex()
            )
        );
        require(
            processedExits[exitHash] == false,
            "RootTunnel: EXIT_ALREADY_PROCESSED"
        );
        processedExits[exitHash] = true;

        ExitPayloadReader.Receipt memory receipt = payload.getReceipt();
        ExitPayloadReader.Log memory log = receipt.getLog();

        // check child tunnel
        require(childTunnel == log.getEmitter(), "RootTunnel: INVALID_CHILD_TUNNEL");

        require(
            MerklePatriciaProof.verify(
                receipt.toBytes(),
                branchMaskBytes,
                payload.getReceiptProof(),
                payload.getReceiptRoot()
            ),
            "RootTunnel: INVALID_RECEIPT_PROOF"
        );

        // verify checkpoint inclusion
        _checkBlockMembershipInCheckpoint(
            payload.getBlockNumber(), 
            payload.getBlockTime(), 
            payload.getTxRoot(), 
            payload.getReceiptRoot(), 
            payload.getHeaderNumber(), 
            payload.getBlockProof()
        );

        ExitPayloadReader.LogTopics memory topics = log.getTopics();

        require(
            bytes32(topics.getField(0).toUint()) == SEND_MESSAGE_EVENT_SIG, // topic0 is event sig
            "RootTunnel: INVALID_SIGNATURE"
        );

        // received message data
        (bytes memory message) = abi.decode(log.getData(), (bytes)); // event decodes params again, so decoding bytes to get message
        return message;
    }

    function _checkBlockMembershipInCheckpoint(
        uint256 blockNumber,
        uint256 blockTime,
        bytes32 txRoot,
        bytes32 receiptRoot,
        uint256 headerNumber,
        bytes memory blockProof
    ) private view returns (uint256) {
        (
            bytes32 headerRoot,
            uint256 startBlock,
            ,
            uint256 createdAt,

        ) = checkpointManager.headerBlocks(headerNumber);

        require(
            keccak256(
                abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot)
            )
                .checkMembership(
                blockNumber.sub(startBlock),
                headerRoot,
                blockProof
            ),
            "RootTunnel: INVALID_HEADER"
        );
        return createdAt;
    }

    /**
     * @notice receive message from  L2 to L1, validated by proof
     * @dev This function verifies if the transaction actually happened on child chain
     *
     * @param inputData RLP encoded data of the reference tx containing following list of fields
     *  0 - headerNumber - Checkpoint header block number containing the reference tx
     *  1 - blockProof - Proof that the block header (in the child chain) is a leaf in the submitted merkle root
     *  2 - blockNumber - Block number containing the reference tx on child chain
     *  3 - blockTime - Reference tx block time
     *  4 - txRoot - Transactions root of block
     *  5 - receiptRoot - Receipts root of block
     *  6 - receipt - Receipt of the reference transaction
     *  7 - receiptProof - Merkle proof of the reference receipt
     *  8 - branchMask - 32 bits denoting the path of receipt in merkle tree
     *  9 - receiptLogIndex - Log Index to read from the receipt
     */
    function receiveMessage(bytes memory inputData) public virtual {
        bytes memory message = _validateAndExtractMessage(inputData);
        _processMessageFromChild(message);
    }

    /**
     * @notice Process message received from Child Tunnel
     * @dev function needs to be implemented to handle message as per requirement
     * This is called by onStateReceive function.
     * Since it is called via a system call, any event will not be emitted during its execution.
     * @param message bytes message that was sent from Child Tunnel
     */
    function _processMessageFromChild(bytes memory message) virtual internal;
}
