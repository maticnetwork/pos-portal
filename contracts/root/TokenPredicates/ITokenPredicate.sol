pragma solidity 0.6.6;

import {RLPReader} from "../../lib/RLPReader.sol";

/// @title Token predicate interface for all pos portal predicates
/// @notice Abstract interface that defines methods for custom predicates
interface ITokenPredicate {

    /**
     * @notice Deposit tokens into pos portal
     * @dev When `depositor` deposits tokens into pos portal, tokens get locked into predicate contract.
     * @param depositor Address who wants to deposit tokens
     * @param depositReceiver Address (address) who wants to receive tokens on side chain
     * @param rootToken Token which gets deposited
     * @param depositData Extra data for deposit (amount for ERC20, token id for ERC721 etc.) [ABI encoded]
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external;

    /**
     * @notice Validates and processes exit while withdraw process
     * @dev Validates exit log emitted on sidechain. Reverts if validation fails.
     * @dev Processes withdraw based on custom logic. Example: transfer ERC20/ERC721, mint ERC721 if mintable withdraw
     * @param sender unused for polygon predicates, being kept for abi compatability
     * @param rootToken Token which gets withdrawn
     * @param logRLPList Valid sidechain log for data like amount, token id etc.
     */
    function exitTokens(
        address sender,
        address rootToken,
        bytes calldata logRLPList
    ) external;

    /**
     * @notice Migrate tokens to a specified target address.
     * @dev This function utilizes the "call" method internally to support various token standards.
     * @param rootToken The address of the ERC token being migrated (not used for Ether predicate).
     * @param data ABI encoded data containing details such as the target address and amount etc.
     */
    function migrateTokens(
        address rootToken,
        bytes calldata data
    ) external;
}
