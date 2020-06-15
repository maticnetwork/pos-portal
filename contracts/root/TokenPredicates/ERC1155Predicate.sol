pragma solidity ^0.6.6;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";

contract ERC1155Predicate is ITokenPredicate, ERC1155Receiver {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    bytes32 public constant TOKEN_TYPE = keccak256("ERC1155");

    // keccak256("TransferSingle(address,address,address,uint256,uint256)")
    bytes32 public constant TRANSFER_SINGLE_EVENT_SIG = 0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62;
    // keccak256("TransferBatch(address,address,address,uint256[],uint256[])")
    bytes32 public constant TRANSFER_BATCH_EVENT_SIG = 0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb;

    // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
    bytes4 public constant ERC1155_RECEIVE_SELECTOR = 0xf23a6e61;
    // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
    bytes4 public constant ERC1155_BATCH_RECEIVE_SELECTOR = 0xbc197c81;

    event LockedBatchERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return ERC1155_RECEIVE_SELECTOR;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return ERC1155_BATCH_RECEIVE_SELECTOR;
    }

    // TODO: add access control
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override {
        // forcing batch deposit since supporting both single and batch deposit introduces too much complexity
        (
            uint256[] memory ids,
            uint256[] memory amounts,
            bytes memory data
        ) = abi.decode(depositData, (uint256[], uint256[], bytes));
        IERC1155(rootToken).safeBatchTransferFrom(
            depositor,
            address(this),
            ids,
            amounts,
            data
        );
        emit LockedBatchERC1155(
            depositor,
            depositReceiver,
            rootToken,
            ids,
            amounts
        );
    }

    function validateExitLog(address withdrawer, bytes calldata log)
        external
        override
        pure
    {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
        require(
            withdrawer == address(logTopicRLPList[1].toUint()), // topic1 is from address
            "ERC1155Predicate: INVALID_SENDER"
        );
        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "ERC1155Predicate: INVALID_RECEIVER"
        );
        require(
            bytes32(logTopicRLPList[0].toUint()) == TRANSFER_SINGLE_EVENT_SIG ||
                bytes32(logTopicRLPList[0].toUint()) ==
                TRANSFER_BATCH_EVENT_SIG, // topic0 is event sig
            "ERC1155Predicate: INVALID_SIGNATURE"
        );
    }

    function exitTokens(
        address withdrawer,
        address rootToken,
        bytes memory log
    ) public override {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
        bytes memory logData = logRLPList[2].toBytes();

        if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_SINGLE_EVENT_SIG) {
            (, , , uint256 id, uint256 amount) = abi.decode(
                logData,
                (address, address, address, uint256, uint256)
            );
            IERC1155(rootToken).safeTransferFrom(
                address(this),
                withdrawer,
                id,
                amount,
                bytes("")
            );
        } else if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_BATCH_EVENT_SIG) {
            (, , , uint256[] memory ids, uint256[] memory amounts) = abi.decode(
                logData,
                (address, address, address, uint256[], uint256[])
            );
            IERC1155(rootToken).safeBatchTransferFrom(
                address(this),
                withdrawer,
                ids,
                amounts,
                bytes("")
            );
        } else {
            revert("ERC1155Predicate: INVALID_WITHDRAW_SIG");
        }
    }
}
