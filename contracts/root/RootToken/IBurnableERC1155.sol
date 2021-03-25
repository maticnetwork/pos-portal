import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

pragma solidity 0.6.6;

interface IBurnableERC1155 is IERC1155 {
    /**
     * @notice Burns `amount` tokens of token type `id`, which is currently owned by `account`.
     * @dev Should be callable only by BurnableERC1155Predicate
     *
     * @param account user address for whom token is being burnt
     * @param id token which is being burnt
     * @param amount amount of token being burnt
     * @param data extra byte data to be accompanied with (to be) burnt tokens
     */
    function burn(address account, uint256 id, uint256 amount, bytes calldata data) external;

    /**
     * @notice Batched version of singular token burning, where
     * for each token in `ids` respective amount to be minted from `amounts`
     * array, for address `to`.
     * @dev Should be callable only by BurnableERC1155Predicate
     *
     * @param to user address for whom token is being burnt
     * @param ids tokens which are being burnt
     * @param amounts amount of each token being burnt
     * @param data extra byte data to be accompanied with (to be) burnt tokens
     */
    function burnBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external;
}
