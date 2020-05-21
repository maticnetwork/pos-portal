pragma solidity "0.6.6";

import { ChildToken } from "./ChildToken.sol";

contract MaitcWETH is ChildToken {
  constructor() public ChildToken("Wrapped Ether", "WETH", 18) {}
}
