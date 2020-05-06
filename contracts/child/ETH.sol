pragma solidity "0.6.6";

import { ChildToken } from "./ChildToken.sol";

contract ETH is ChildToken {
  constructor() public ChildToken("Ether", "ETH", 18) {}
}
