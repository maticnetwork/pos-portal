pragma solidity 0.6.6;

import {IRootChainManager} from "./IRootChainManager.sol";

/**
 * @title Root Chain Manager Storage Extension
 * @dev This contract is an extension of the RootChainManager storage.
 * It is used to APPEND additional storage for the RootChainManager.
 */
abstract contract RootChainManagerStorageExtension {
    /// @notice Mapping to track the stoppage status of tokens.
    /// @dev Maps token address to its stoppage status as defined in IRootChainManager.
    mapping(address => IRootChainManager.TokenStoppageStatus) public stoppageStatus;
}
