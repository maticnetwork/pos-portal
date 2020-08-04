pragma solidity ^0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";
import {IMetaDataERC721} from "./IMetaDataERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";

contract DummyMetaDataERC721 is
    ERC721,
    NetworkAgnostic,
    ChainConstants,
    ContextMixin,
    IMetaDataERC721,
    AccessControlMixin
{
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
        NetworkAgnostic(name_, ERC712_VERSION, ROOT_CHAIN_ID)
    {
        _setupContractId("ChildMetaDataERC721");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    function mint(uint256 tokenId) external virtual only(DEFAULT_ADMIN_ROLE) {
        _mint(_msgSender(), tokenId);
    }

    function setTokenURI(uint256 tokenId, string calldata tokenURI) external virtual only(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(tokenId, tokenURI);
    }

    /**
     * @notice returns bytes metadata for token
     * @dev metadata is made of only tokenURI for example but it can be any arbitrary bytes
     * @param tokenId tokenId to fetch metadata
     */
    function getMetaData(uint256 tokenId) external view override virtual returns(bytes memory) {
        return abi.encode(tokenURI(tokenId));
    }

    /**
     * @notice set metadata for token, callable only by MetaDataERC721Predicate
     * @dev metadata is made of only tokenURI for example but it can be any arbitrary bytes
     * @param tokenId tokenId to fetch metadata
     * @param metadata bytes data that can be decoded updated for token
     */
    function setMetaData(uint256 tokenId, bytes calldata metadata) external override virtual only(PREDICATE_ROLE) {
        string memory tokenURI = abi.decode(metadata, (string));
        _setTokenURI(tokenId, tokenURI);
    }
}
