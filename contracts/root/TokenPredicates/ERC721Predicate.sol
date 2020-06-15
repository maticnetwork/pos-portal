pragma solidity ^0.6.6;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";

contract ERC721Predicate is ITokenPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    bytes32 public constant TOKEN_TYPE = keccak256("ERC721");
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    event LockedERC721(
        address indexed from,
        address indexed user,
        address indexed rootToken,
        uint256 tokenId
    );

    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override {
        uint256 tokenId = abi.decode(depositData, (uint256));
        IERC721(rootToken).transferFrom(depositor, address(this), tokenId);
        emit LockedERC721(depositor, depositReceiver, rootToken, tokenId);
    }

    function validateExitLog(address msgSender, bytes calldata log)
        external
        override
        pure
    {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
        require(
            bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is event sig
            "RootChainManager: INVALID_SIGNATURE"
        );
        require(
            msgSender == address(logTopicRLPList[1].toUint()), // topic1 is from address
            "RootChainManager: INVALID_SENDER"
        );
        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "RootChainManager: INVALID_RECEIVER"
        );
    }

    function exitTokens(
        address msgSender,
        address rootToken,
        bytes memory log
    ) public override {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        IERC721(rootToken).transferFrom(
            address(this),
            msgSender,
            logRLPList[2].toUint() // log data field
        );
    }
}
