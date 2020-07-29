import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity ^0.6.6;

// todo: comments
interface IMetaDataERC721 is IERC721 {
    function getMetaData(uint256 tokenId) external view returns(bytes memory);

    function setMetaData(uint256 tokenId, bytes calldata metadata) external;
}
