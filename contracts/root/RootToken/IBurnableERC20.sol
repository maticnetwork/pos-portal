import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity 0.6.6;

interface IBurnableERC20 is IERC20 {
    /**
     * @notice called by predicate contract to burn tokens while withdrawing, not transferring to withdrawer
     * @dev Should be callable only by BurnableERC20Predicate
     *
     * It'll be better to do burning only here, so that when certain event signature
     * is seen while unlocking tokens, tokens are burnt on L1, as they were done on L2
     * when `withdraw` method was invoked in respective child contract.
     *
     * @param user user address for whom token is being minted
     * @param amount amount of token being minted
     */
    function burn(address user, uint256 amount) external;
}
