pragma solidity ^0.6.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";

contract ERC20Predicate is ITokenPredicate {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    bytes32 public constant TOKEN_TYPE = keccak256("ERC20");
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    event LockedERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override {
        uint256 amount = abi.decode(depositData, (uint256));
        IERC20(rootToken).transferFrom(depositor, address(this), amount);
        emit LockedERC20(depositor, depositReceiver, rootToken, amount);
    }

    function validateExitLog(address withdrawer, bytes calldata log)
        external
        override
        pure
    {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
        require(
            bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is event sig
            "ERC20Predicate: INVALID_SIGNATURE"
        );
        require(
            withdrawer == address(logTopicRLPList[1].toUint()), // topic1 is from address
            "ERC20Predicate: INVALID_SENDER"
        );
        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "ERC20Predicate: INVALID_RECEIVER"
        );
    }

    function exitTokens(
        address withdrawer,
        address rootToken,
        bytes memory log
    ) public override {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        IERC20(rootToken).transfer(
            withdrawer,
            logRLPList[2].toUint() // log data field
        );
    }
}
