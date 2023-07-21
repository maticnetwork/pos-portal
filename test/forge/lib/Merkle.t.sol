// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {MurkyPredeployer} from "test/forge/lib/utils/MurkyPredeployer.sol";

import {Merkle} from "contracts/lib/Merkle.sol";

contract MerkleTest is Test, MurkyPredeployer {
    MerkleUser merkleUser;

    function setUp() public {
        merkleUser = new MerkleUser();
    }

    function testCannotCheckMembership_InvalidProofLength(uint256 proofSize) public {
        vm.assume(proofSize != 0);
        vm.assume(proofSize % 32 != 0);
        bytes memory proof = new bytes(32 + 1);
        vm.expectRevert("Invalid proof length");
        merkleUser.checkMembership("", 0, "", proof);
    }

    function testCannotCheckMembership_InvalidIndex(uint256 index, uint8 proofSize) public {
        vm.assume(proofSize % 32 == 0);
        index = bound(index, 2 ** uint256(proofSize), UINT256_MAX);
        bytes memory proof = new bytes(proofSize);

        vm.expectRevert("Leaf index is too big");
        merkleUser.checkMembership("", index, "", proof);
    }

    function testCheckMembership(bytes32[] memory leaves, uint256 index) public {
        vm.assume(leaves.length > 1);
        // bound index
        index %= leaves.length - 1;

        (bytes32 root, bytes32[] memory _proof) = murkyPredeploy.getRootAndProof(leaves, index);

        // get merkle root and proof
        bytes32 leaf = leaves[index];
        vm.assume(leaf != bytes32(0));
        bytes32 randomDataHash = keccak256(abi.encode(leaf));

        bytes memory proof = abi.encodePacked(_proof);

        // should return true for leaf and false for random hash
        assertTrue(merkleUser.checkMembership(leaf, index, root, proof));
        assertFalse(merkleUser.checkMembership(randomDataHash, index, root, proof));
    }
}

/*//////////////////////////////////////////////////////////////////////////
                                MOCKS
//////////////////////////////////////////////////////////////////////////*/

contract MerkleUser {
    function checkMembership(bytes32 leaf, uint256 index, bytes32 rootHash, bytes calldata proof)
        external
        pure
        returns (bool)
    {
        bool r = Merkle.checkMembership(leaf, index, rootHash, proof);
        return r;
    }
}
