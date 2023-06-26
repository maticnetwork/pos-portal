// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {NativeMetaTransaction} from "contracts/common/NativeMetaTransaction.sol";

contract NativMetaTransactionTest is Test {
    event MetaTransactionExecuted(
        address indexed userAddress,
        address payable indexed relayerAddress,
        bytes functionSignature
    );
    bytes32 private constant META_TRANSACTION_TYPEHASH =
        keccak256(
            bytes(
                "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
            )
        );

    Account internal signer;

    NativeMetaTransaction internal nativeMetaTransaction;

    function setUp() public {
        signer = makeAccount("signer");

        nativeMetaTransaction = new NativeMetaTransaction();
    }

    function testCannotExecuteMetaTransaction_InvalidSigner() public {
        vm.expectRevert("NativeMetaTransaction: INVALID_SIGNER");

        nativeMetaTransaction.executeMetaTransaction(address(0), "", 0, 0, 0);
    }

    function testCannotExecuteMetaTransaction_SignatureMismatch() public {
        vm.expectRevert("Signer and signature do not match");

        nativeMetaTransaction.executeMetaTransaction(signer.addr, "", 0, 0, 0);
    }

    function testCannotExecuteMetaTransaction_CallFailed() public {
        bytes memory invalidFunctionSignature;

        NativeMetaTransaction.MetaTransaction
            memory metaTx = NativeMetaTransaction.MetaTransaction({
                nonce: 0,
                from: signer.addr,
                functionSignature: invalidFunctionSignature
            });

        bytes32 digest = _toTypedMessageHash(_hashMetaTransaction(metaTx));

        (uint8 sigV, bytes32 sigR, bytes32 sigS) = vm.sign(signer.key, digest);

        vm.expectRevert("Function call not successful");

        nativeMetaTransaction.executeMetaTransaction(
            signer.addr,
            invalidFunctionSignature,
            sigR,
            sigS,
            sigV
        );
    }

    function testExecuteMetaTransaction() public {
        bytes memory functionSignature = abi.encodeWithSignature(
            "getNonce(address)",
            signer.addr
        );

        NativeMetaTransaction.MetaTransaction
            memory metaTx = NativeMetaTransaction.MetaTransaction({
                nonce: 0,
                from: signer.addr,
                functionSignature: functionSignature
            });

        bytes32 digest = _toTypedMessageHash(_hashMetaTransaction(metaTx));

        (uint8 sigV, bytes32 sigR, bytes32 sigS) = vm.sign(signer.key, digest);

        vm.expectEmit();
        emit MetaTransactionExecuted(
            signer.addr,
            payable(address(this)),
            functionSignature
        );

        bytes memory returnData = nativeMetaTransaction.executeMetaTransaction(
            signer.addr,
            functionSignature,
            sigR,
            sigS,
            sigV
        );

        assertEq(nativeMetaTransaction.getNonce(signer.addr), 1);
        assertEq(returnData, abi.encode(1));
    }

    function testGetNonce() public {
        assertEq(nativeMetaTransaction.getNonce(signer.addr), 0);
    }

    function _hashMetaTransaction(
        NativeMetaTransaction.MetaTransaction memory metaTx
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    META_TRANSACTION_TYPEHASH,
                    metaTx.nonce,
                    metaTx.from,
                    keccak256(metaTx.functionSignature)
                )
            );
    }

    function _toTypedMessageHash(
        bytes32 messageHash
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    nativeMetaTransaction.getDomainSeperator(),
                    messageHash
                )
            );
    }
}
