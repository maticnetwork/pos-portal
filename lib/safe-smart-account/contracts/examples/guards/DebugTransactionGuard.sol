// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "./../../interfaces/ISafe.sol";
import {Enum} from "./../../libraries/Enum.sol";
import {BaseGuard} from "./BaseGuard.sol";

/**
 * @title Debug Transaction Guard - Emits transaction events with extended information.
 * @dev This guard is only meant as a development tool and example
 * @author Richard Meissner - @rmeissner
 */
contract DebugTransactionGuard is BaseGuard {
    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    event TransactionDetails(
        address indexed safe,
        bytes32 indexed txHash,
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        bool usesRefund,
        uint256 nonce,
        bytes signatures,
        address executor
    );

    event ModuleTransactionDetails(bytes32 indexed txHash, address to, uint256 value, bytes data, Enum.Operation operation, address module);

    event GasUsage(address indexed safe, bytes32 indexed txHash, uint256 indexed nonce, bool success);

    mapping(bytes32 => uint256) public txNonces;

    /**
     * @notice Called by the Safe contract before a transaction is executed.
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Gas costs that are independent of the transaction execution (e.g. base transaction fee, signature check, payment of the refund)
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 if ETH) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
     * @param signatures Signature data that should be verified. Can be packed ECDSA signature ({bytes32 r}{bytes32 s}{uint8 v}), contract signature (EIP-1271) or approved hash.
     * @param executor Account executing the transaction.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        // solhint-disable-next-line no-unused-vars
        address payable refundReceiver,
        bytes memory signatures,
        address executor
    ) external override {
        uint256 nonce;
        bytes32 txHash;
        {
            ISafe safe = ISafe(payable(msg.sender));
            nonce = safe.nonce() - 1;
            txHash = safe.getTransactionHash(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce);
        }
        emit TransactionDetails(msg.sender, txHash, to, value, data, operation, safeTxGas, gasPrice > 0, nonce, signatures, executor);
        txNonces[txHash] = nonce;
    }

    /**
     * @notice Called by the Safe contract after a transaction is executed.
     * @param txHash Hash of the executed transaction.
     * @param success True if the transaction was successful.
     */
    function checkAfterExecution(bytes32 txHash, bool success) external override {
        uint256 nonce = txNonces[txHash];
        require(nonce != 0, "Could not get nonce");
        txNonces[txHash] = 0;
        emit GasUsage(msg.sender, txHash, nonce, success);
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed via a module.
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param module Account executing the transaction.
     * @return moduleTxHash Hash of the module transaction.
     */
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        address module
    ) external override returns (bytes32 moduleTxHash) {
        moduleTxHash = keccak256(abi.encodePacked(to, value, data, operation, module));

        emit ModuleTransactionDetails(moduleTxHash, to, value, data, operation, module);
    }

    /**
     * @notice Called by the Safe contract after a module transaction is executed.
     * @dev No-op.
     */
    function checkAfterModuleExecution(bytes32 txHash, bool success) external override {}
}
