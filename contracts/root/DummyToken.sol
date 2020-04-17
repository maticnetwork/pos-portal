pragma solidity "0.6.6";

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DummyToken is ERC20 {
  constructor() public ERC20("Dummy Parent Token", "DUMMY") {
    uint256 value = 10**10 * (10**18);
    _mint(msg.sender, value);
  }
}
