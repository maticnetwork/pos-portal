pragma solidity ^0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";

contract DummyERC721 is ERC721, AccessControl, NetworkAgnostic, ChainConstants {
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
        NetworkAgnostic(name_, ERC712_VERSION, ROOT_CHAIN_ID)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
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
     * @notice called by predicate contract to mint tokens while withdrawing
     * @dev Should be callable only by MintableERC721Predicate
     * Make sure minting is done only by this function
     * @param user user address for whom token is being minted
     * @param tokenId tokenId being minted
     */
    function mint(address user, uint256 tokenId) external only(PREDICATE_ROLE) {
        _mint(user, tokenId);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }
}
