import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity ^0.6.6;

interface IMetaDataERC721 is IERC721 {
    /**
     * @notice returns bytes metadata for token that is transferred
     * while depositing token to matic chain
     * @param tokenId tokenId to fetch metadata
     */
    function getMetaData(uint256 tokenId) external view returns(bytes memory);

    /**
     * @notice set metadata for token, callable only by MetaDataERC721Predicate
     * MetaData is set while withdrawing token from matic chain
     * @param tokenId tokenId to fetch metadata
     * @param metadata bytes data that can be decoded updated for token
     */
    function setMetaData(uint256 tokenId, bytes calldata metadata) external;
}
