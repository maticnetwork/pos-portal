// This contract is not supposed to be used in production
// It's strictly for testing purpose

pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract DummyERC721 is
    ERC721,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
    {
        _setupContractId("DummyERC721");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
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
