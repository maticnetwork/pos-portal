pragma solidity 0.6.6;

import {MerklePatriciaProof} from "../lib/MerklePatriciaProof.sol";
import {RLPReader} from "../lib/RLPReader.sol";

contract MerklePatriciaTest {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    function verify(uint receiptRoot, bytes calldata receipt, bytes calldata receiptProof, bytes calldata branchMask) external pure returns(bool) {

        return MerklePatriciaProof.verify(
            receipt, // receipt
            branchMask, // branchMask
            receiptProof, // receiptProof
            bytes32(receiptRoot) // receiptRoot
        );
    }
}
