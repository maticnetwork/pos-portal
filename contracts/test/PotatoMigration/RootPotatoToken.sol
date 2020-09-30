pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// These are the potatoes on Ethereum chain
contract RootPotatoToken is ERC20 {
    constructor() public ERC20("Potato", "PTT") {}

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}
