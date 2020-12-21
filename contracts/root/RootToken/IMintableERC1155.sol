import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

pragma solidity 0.6.6;

interface IMintableERC1155 is IERC1155 {
    /**
     * @notice Creates `amount` tokens of token type `id`, and assigns them to `account`.
     * @dev Should be callable only by MintableERC1155Predicate
     * Make sure minting is done only by this function
     * @param account user address for whom token is being minted
     * @param id token which is being minted
     * @param amount amount of token being minted
     * @param data extra byte data to be accompanied with minted tokens
     */
    function mint(address account, uint256 id, uint256 amount, bytes calldata data) external;

    /**
     * @notice Batched version of singular token minting, where
     * for each token in `ids` respective amount to be minted from `amounts`
     * array, for address `to`.
     * @dev Should be callable only by MintableERC1155Predicate
     * Make sure minting is done only by this function
     * @param to user address for whom token is being minted
     * @param ids tokens which are being minted
     * @param amounts amount of each token being minted
     * @param data extra byte data to be accompanied with minted tokens
     */
    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external;
}
