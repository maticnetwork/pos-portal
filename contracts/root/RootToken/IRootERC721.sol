import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity 0.6.6;

interface IRootERC721 is IERC721 {

    // Make sure you implement this method is root ERC721
    // contract when you're interested in transferring
    // metadata from L2 to L1
    function setTokenMetadata(uint256 tokenId, bytes calldata data) external;

}
