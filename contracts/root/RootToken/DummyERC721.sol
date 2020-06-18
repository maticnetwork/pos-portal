pragma solidity "0.6.6";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";

contract DummyERC721 is ERC721, NetworkAgnostic, ChainConstants {
    constructor(string memory name, string memory symbol)
        public
        ERC721(name, symbol)
        NetworkAgnostic(name, "1", ROOT_CHAIN_ID)
    {}

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

    function mint(uint256 tokenId) public {
        _mint(_msgSender(), tokenId);
    }
}
