import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity 0.6.6;

interface IMintableERC721 is IERC721 {
    /**
     * @notice called by predicate contract to mint tokens while withdrawing
     * @dev Should be callable only by MintableERC721Predicate
     * Make sure minting is done only by this function
     * @param user user address for whom token is being minted
     * @param tokenId tokenId being minted
     */
    function mint(address user, uint256 tokenId) external;

    /**
     * @notice called by predicate contract to mint tokens while withdrawing with metadata from L2
     * @dev Should be callable only by MintableERC721Predicate
     * Make sure minting is only done either by this function/ 👆
     * @param user user address for whom token is being minted
     * @param tokenId tokenId being minted
     * @param uri associate uri of token, by calling internal function `_setTokenURI`
     *
     * Here : https://github.com/OpenZeppelin/openzeppelin-contracts/blob/ee6348a7a0b08f82344f2b61e903788aa9dcf36c/contracts/token/ERC721/ERC721.sol#L371-L374
     * Setting URI is fully root token implementor's responsibility
     *
     * Note : If you're interested in taking token metadata from L2 to L1 during exit, you must
     * implement this method
     */
    function mint(address user, uint256 tokenId, string uri) external;

    /**
     * @notice check if token already exists, return true if it does exist
     * @dev this check will be used by the predicate to determine if the token needs to be minted or transfered
     * @param tokenId tokenId being checked
     */
    function exists(uint256 tokenId) external view returns (bool);
}
