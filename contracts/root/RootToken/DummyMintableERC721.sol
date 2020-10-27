pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {IMintableERC721} from "./IMintableERC721.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract DummyMintableERC721 is
    ERC721,
    AccessControlMixin,
    NativeMetaTransaction,
    IMintableERC721,
    ContextMixin
{
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
    {
        _setupContractId("DummyMintableERC721");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
        _initializeEIP712(name_);
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    /**
     * @dev See {IMintableERC721-mint}.
     */
    function mint(address user, uint256 tokenId) external override only(PREDICATE_ROLE) {
        _mint(user, tokenId);
    }

    /**
     * @dev See {IMintableERC721-exists}.
     */
    function exists(uint256 tokenId) external view override returns (bool) {
        return _exists(tokenId);
    }
}
