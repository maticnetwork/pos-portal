pragma solidity "0.6.6";

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract ParentToken is ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20(name, symbol) {
    _setupDecimals(decimals);
  }
}
