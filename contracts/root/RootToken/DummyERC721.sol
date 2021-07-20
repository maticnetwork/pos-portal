// This contract is not supposed to be used in production
// It's strictly for testing purpose

pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {IRootERC721} from "./IRootERC721.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract DummyERC721 is
    ERC721,
    AccessControlMixin,
    NativeMetaTransaction,
    IRootERC721,
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

    /**
     * If you're attempting to bring metadata associated with token
     * from L2 to L1, you must implement this method
     *
     * To be invoked when attempting to exit ERC721 with metadata from L2
     *
     * `data` is nothing but arbitrary byte array which
     * is brought in L1, by event emitted in L2, during withdraw
     *
     * Make sure this method is always callable by Predicate contract
     * who will invoke it when attempting to exit with metadata
     */
    function setTokenMetadata(uint256 tokenId, bytes calldata data) external override only(PREDICATE_ROLE) {
        // This function should decode metadata obtained from L2
        // and attempt to set it for this `tokenId`
        //
        // Following is just a default implementation, feel
        // free to define your own encoding/ decoding scheme
        // for L2 -> L1 token metadata transfer
        string memory uri = abi.decode(data, (string));

        _setTokenURI(tokenId, uri);
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
