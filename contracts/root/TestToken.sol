pragma solidity "0.6.6";

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20(name, symbol) {
    _setupDecimals(decimals);
    uint256 value = 10**10 * (10**18);
    _mint(msg.sender, value);
  }
}
