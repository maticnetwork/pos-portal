pragma solidity ^0.6.6;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


contract DummyERC1155 is ERC1155{
    constructor(string memory uri_)
        public
        ERC1155(uri_)
    {}

    function mint(address account, uint256 id, uint256 amount) public {
        _mint(account, id, amount, bytes(""));
    }
}
