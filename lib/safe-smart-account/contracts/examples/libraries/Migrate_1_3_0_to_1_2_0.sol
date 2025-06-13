// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import {SafeStorage} from "../../libraries/SafeStorage.sol";

/**
 * @title Migration - Migrates a Safe contract from 1.3.0 to 1.2.0
 * @author Richard Meissner - @rmeissner
 */
contract Migration is SafeStorage {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    address public immutable MIGRATION_SINGLETON;
    address public immutable SAFE_120_SINGLETON;

    constructor(address targetSingleton) {
        // Singleton address cannot be zero address.
        require(targetSingleton != address(0), "Invalid singleton address provided");
        SAFE_120_SINGLETON = targetSingleton;
        MIGRATION_SINGLETON = address(this);
    }

    event ChangedMasterCopy(address singleton);

    /**
     * @notice Migrates the Safe to the Singleton contract at `migrationSingleton`.
     * @dev This can only be called via a delegatecall.
     */
    function migrate() public {
        require(address(this) != MIGRATION_SINGLETON, "Migration should only be called via delegatecall");

        singleton = SAFE_120_SINGLETON;
        _deprecatedDomainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, this));
        emit ChangedMasterCopy(singleton);
    }
}
