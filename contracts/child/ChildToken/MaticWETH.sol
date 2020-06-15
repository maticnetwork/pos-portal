pragma solidity "0.6.6";

import {ChildToken} from "./ChildToken.sol";

contract MaticWETH is ChildToken {
    constructor() public ChildToken("Wrapped Ether", "WETH", 18) {}
}
