import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity 0.6.6;

interface IBurnableERC721 is IERC721 {
    /**
     * @notice called by admin for minting tokens on L1
     * @dev In example implementation you'll find this function not being protected
     * but that's done for ease of test case writing, in practice it might be dangerous
     * @param tokenId tokenId being minted
     */
    function mint(uint256 tokenId) external;

    /**
     * @notice called by predicate contract to **actually** burn token on L1
     * @dev Should be callable only by BurnableERC721Predicate
     *
     * @param tokenId token being burnt
     */
    function burn(uint256 tokenId) external;

    /**
     * @notice called by predicate contract to **actually** burn token on L1, 
     * while brining arbitrary data from L2
     *
     * @dev Should be callable only by MintableERC721Predicate
     *
     * @param tokenId token being burnt
     * @param metaData associated token metadata, to be decoded & set using `setTokenMetadata`
     *
     * Note : If you're interested in taking token metadata from L2 to L1 during exit, you must
     * implement this method
     */
    function burn(uint256 tokenId, bytes calldata metaData) external;

    /**
     * @notice check if token already exists, return true if it does exist
     * @dev this check will be used by the predicate to determine if token can be burnt or not
     * @param tokenId tokenId being checked
     */
    function exists(uint256 tokenId) external view returns (bool);

    /**
     * @notice When you're transferring your L2 token along with some arbitrary
     * metadata, but not **burning** on L1, this method will be invoked by predicate
     *
     * @dev Make sure you implement it
     *
     * @param tokenId Metadata being transferred is associated with it
     * @param data Arbitrary metadata, encoding/ decoding child's responsibility
     */
    function transferMetadata(uint256 tokenId, bytes calldata data) external;
}
