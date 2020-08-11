pragma solidity ^0.6.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyERC20 is ERC20{
    constructor(string memory name_, string memory symbol_)
        public
        ERC20(name_, symbol_)
    {
        uint256 amount = 10**10 * (10**18);
        _mint(_msgSender(), amount);
    }
    
    function mint(uint256 amount) public {
        _mint(_msgSender(), amount);
    }
}
