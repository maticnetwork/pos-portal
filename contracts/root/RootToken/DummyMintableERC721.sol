pragma solidity ^0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";
import {IMintableERC721} from "./IMintableERC721.sol";

contract DummyMintableERC721 is ERC721, AccessControl, NetworkAgnostic, ChainConstants, IMintableERC721 {
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
        NetworkAgnostic(name_, ERC712_VERSION, ROOT_CHAIN_ID)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
    }

    modifier only(bytes32 role) {
        require(hasRole(role, _msgSender()), "DummyERC721: INSUFFICIENT_PERMISSIONS");
        _;
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
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
