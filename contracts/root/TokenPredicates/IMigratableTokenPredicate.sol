pragma solidity 0.6.6;

/**
 * @notice Implemented only by predicates whose locked funds can be migrated out.
 * @dev Deliberately NOT part of ITokenPredicate. Every deployed predicate implements
 * ITokenPredicate, and only ERC20Predicate was redeployed with migration support, so
 * declaring migrateTokens there would force a stub into predicates whose on-chain
 * bytecode does not have one. See scripts/pinning/.
 */
interface IMigratableTokenPredicate {
    /**
     * @notice Allows migration of tokens from the predicate to another address.
     * @param target The target address.
     * @param data ABI encoded information including details like the token amount, and other relevant data.
     */
    function migrateTokens(address target, bytes calldata data) external;
}
