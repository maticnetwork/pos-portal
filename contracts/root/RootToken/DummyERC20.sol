pragma solidity "0.6.6";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";

contract DummyERC20 is ERC20, NetworkAgnostic, ChainConstants {
    constructor(string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
        NetworkAgnostic(_name, ERC712_VERSION, ROOT_CHAIN_ID)
    {
        uint256 amount = 10**10 * (10**18);
        _mint(_msgSender(), amount);
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

    function mint(uint256 amount) public {
        _mint(_msgSender(), amount);
    }
}
