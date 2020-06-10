pragma solidity ^0.6.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";


contract ERC20Predicate is ITokenPredicate, Context {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    bytes32 public tokenType = keccak256("ERC20");

    event LockedERC20(
        address indexed from,
        address indexed user,
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

    function validateExitLog(bytes memory burnLogRLP) public override pure {}

    function exitTokens(bytes memory burnLogRLP) public override {}
}
