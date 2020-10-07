pragma solidity 0.6.6;

import {UChildERC20} from "../child/ChildToken/UpgradeableChildERC20/UChildERC20.sol";

contract TestUChildERC20 is UChildERC20 {
    function magic() external pure returns (string memory) {
      return "magic";
    }
}
