pragma solidity ^0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";
import {IMetaDataERC721} from "./IMetaDataERC721.sol";

// todo: comments
// todo: access control
contract DummyMetaDataERC721 is ERC721, NetworkAgnostic, ChainConstants, ContextMixin, IMetaDataERC721 {
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
        NetworkAgnostic(name_, ERC712_VERSION, ROOT_CHAIN_ID)
    {}

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    function mint(uint256 tokenId) public {
        _mint(_msgSender(), tokenId);
    }

    function setTokenURI(uint256 tokenId, string memory tokenURI) internal virtual {
        _setTokenURI(tokenId, tokenURI);
    }

    function getMetaData(uint256 tokenId) external view override returns(bytes memory) {
        return abi.encode(tokenURI(tokenId));
    }

    function setMetaData(uint256 tokenId, bytes calldata metadata) external override {
        string memory tokenURI = abi.decode(metadata, (string));
        _setTokenURI(tokenId, tokenURI);
    }
}
