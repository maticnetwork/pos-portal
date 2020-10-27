pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract DummyERC721 is
    ERC721,
    NativeMetaTransaction,
    ContextMixin
{
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
    {
        _initializeEIP712(name_);
    }

    function mint(uint256 tokenId) public {
        _mint(_msgSender(), tokenId);
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }
}
