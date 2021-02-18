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
     * @param metaData Associated token metadata, to be decoded & set using `_setTokenMetadata`
     *
     * Note : If you're interested in taking token metadata from L2 to L1 during exit, you must
     * implement this method
     */
    function mint(address user, uint256 tokenId, bytes calldata metaData) external;

    /**
     * @notice To be called when exiting token with metadata from L2
     *
     * @dev This method needs to be implemented in root chain contract
     * and to be invoked by predicate contract when exiting token
     * with extra metadata
     *
     * Decoding of `data` is completely upto implementor, just need to take care
     * of how it was encoded in L2, using method `ChildMintableERC721.encodeTokenMetadata`
     *
     * @param tokenId Token for which metadata being set
     * @param metaData Associated token metadata, to be decoded & set here
     */
    function _setTokenMetadata(uint256 tokenId, bytes memory data) internal;

    /**
     * @notice check if token already exists, return true if it does exist
     * @dev this check will be used by the predicate to determine if the token needs to be minted or transfered
     * @param tokenId tokenId being checked
     */
    function exists(uint256 tokenId) external view returns (bool);
}
