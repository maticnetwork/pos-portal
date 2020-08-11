pragma solidity ^0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DummyERC721 is ERC721{
    constructor(string memory name_, string memory symbol_)
        public
        ERC721(name_, symbol_)
    {}

    function mint(uint256 tokenId) public {
        _mint(_msgSender(), tokenId);
    }
}
