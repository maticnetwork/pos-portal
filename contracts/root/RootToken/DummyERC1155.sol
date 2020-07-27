pragma solidity ^0.6.6;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";
import {ContextLib} from "../../lib/ContextLib.sol";

contract DummyERC1155 is ERC1155, NetworkAgnostic, ChainConstants {
    constructor(string memory uri_)
        public
        ERC1155(uri_)
        NetworkAgnostic(uri_, ERC712_VERSION, ROOT_CHAIN_ID)
    {}

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextLib.msgSender();
    }

    function mint(address account, uint256 id, uint256 amount) public {
        _mint(account, id, amount, bytes(""));
    }
}
