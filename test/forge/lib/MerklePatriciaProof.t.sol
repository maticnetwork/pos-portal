// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";
import {MerklePatriciaTest} from "contracts/test/MerklePatriciaTest.sol";

contract MerklePatriciaProofTest is Test {
    function test_proof() external {
        uint256 idx = 0;
        string[] memory inputs = new string[](4);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/lib/utils/proofGen.ts";
        inputs[3] = vm.toString(idx);
        bytes memory res = vm.ffi(inputs);
        (
            uint256 receiptsRoot,
            bytes memory receipt,
            bytes memory receiptProof,
            bytes memory branchMask
        ) = abi.decode(res, (uint256, bytes, bytes, bytes));

        MerklePatriciaTest target = new MerklePatriciaTest();
        target.verify(receiptsRoot, receipt, receiptProof, branchMask);
    }
}
