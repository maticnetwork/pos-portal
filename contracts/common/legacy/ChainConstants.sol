pragma solidity 0.6.6;

/**
 * @notice FROZEN. Reproduces the deployed child-token implementations and nothing else.
 * @dev This was a generated file (ChainConstants.sol.template) back when the child tokens were
 * deployed; the template is gone and the constants below are the values it rendered for the
 * Ethereum/Polygon pair. Kept only so UChildERC20 still compiles to its live bytecode — the
 * implementations behind every mapped ERC20 on Polygon read ERC712_VERSION from here.
 * Do not use in new code and do not edit: see scripts/pinning/.
 */
contract ChainConstants {
    string constant public ERC712_VERSION = "1";

    uint256 constant public ROOT_CHAIN_ID = 1;
    bytes constant public ROOT_CHAIN_ID_BYTES = hex"01";

    uint256 constant public CHILD_CHAIN_ID = 137;
    bytes constant public CHILD_CHAIN_ID_BYTES = hex"89";
}
