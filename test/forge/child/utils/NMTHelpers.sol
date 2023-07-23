// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import {Script} from "forge-std/Script.sol";

import {NativeMetaTransaction} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildERC20.sol";

interface INMTContract {
    function executeMetaTransaction(
        address userAddress,
        bytes calldata functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable returns (bytes memory);

    function getDomainSeperator() external view returns (bytes32);

    function getNonce(address user) external view returns (uint256);
}

abstract contract NMTHelpers is Script {
    event MetaTransactionExecuted(
        address indexed userAddress, address payable indexed relayerAddress, bytes functionSignature
    );

    bytes32 private constant META_TRANSACTION_TYPEHASH =
        keccak256(bytes("MetaTransaction(uint256 nonce,address from,bytes functionSignature)"));

    INMTContract internal nmtContract;

    function executeMetaTransaction(address contractAddr, bytes memory funcSigAndParams, Account memory signer)
        internal
        returns (bytes memory returnData)
    {
        returnData = _executeMetaTransaction(contractAddr, funcSigAndParams, signer, false);
    }

    function expectMetaTransactionRevert(address contractAddr, bytes memory funcSigAndParams, Account memory signer)
        internal
    {
        _executeMetaTransaction(contractAddr, funcSigAndParams, signer, true);
    }

    function skipMetaTransactionEvent() internal {
        vm.expectEmit(false, false, false, false);
        emit MetaTransactionExecuted(address(0), payable(address(0)), "");
    }

    function _executeMetaTransaction(
        address contractAddr,
        bytes memory funcSigAndParams,
        Account memory signer,
        bool expectRevert
    ) private returns (bytes memory returnData) {
        nmtContract = INMTContract(contractAddr);

        NativeMetaTransaction.MetaTransaction memory metaTx = NativeMetaTransaction.MetaTransaction({
            nonce: nmtContract.getNonce(signer.addr),
            from: signer.addr,
            functionSignature: funcSigAndParams
        });

        bytes32 digest = _toTypedMessageHash(_hashMetaTransaction(metaTx));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer.key, digest);

        if (expectRevert) {
            vm.expectRevert("Function call not successful");
        }

        returnData = nmtContract.executeMetaTransaction(signer.addr, funcSigAndParams, r, s, v);
    }

    function _hashMetaTransaction(NativeMetaTransaction.MetaTransaction memory metaTx) private pure returns (bytes32) {
        return keccak256(
            abi.encode(META_TRANSACTION_TYPEHASH, metaTx.nonce, metaTx.from, keccak256(metaTx.functionSignature))
        );
    }

    function _toTypedMessageHash(bytes32 messageHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", nmtContract.getDomainSeperator(), messageHash));
    }
}
