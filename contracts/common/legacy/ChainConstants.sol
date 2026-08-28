pragma solidity 0.6.6;

/**
 * @notice FROZEN. Reproduces the deployed child-token implementations and nothing else.
 * @dev This was a generated file (ChainConstants.sol.template, rendered by
 * scripts/process-templates.js) back when the child tokens were deployed; the template is gone
 * and the constants below are the values it rendered. Kept only so UChildERC20 still compiles to
 * its live bytecode.
 *
 * Only ERC712_VERSION is ever read — UChildERC20.initialize() and changeName() pass it to
 * _initializeEIP712/_setDomainSeperator. The two chain ids are dead as far as this repo is
 * concerned, but they are `constant public`, so solc emits a getter for each into the runtime of
 * every contract that inherits this. That makes them load-bearing for reproducibility even though
 * nothing calls them.
 *
 * These are NOT mainnet-only values and must not be turned back into per-network template
 * parameters. The child-token implementations deployed on Amoy carry the same 1/137 pair — read
 * ROOT_CHAIN_ID()/CHILD_CHAIN_ID() on any mapped UChildERC20 there — because testnet was seeded
 * with the artifact rendered for the Ethereum/Polygon pair rather than one re-rendered for its own
 * chain ids. Re-parameterising this file would break every deployment on every network at once.
 *
 * Do not use in new code and do not edit: see scripts/pinning/.
 */
contract ChainConstants {
    string constant public ERC712_VERSION = "1";

    uint256 constant public ROOT_CHAIN_ID = 1;
    bytes constant public ROOT_CHAIN_ID_BYTES = hex"01";

    uint256 constant public CHILD_CHAIN_ID = 137;
    bytes constant public CHILD_CHAIN_ID_BYTES = hex"89";
}
