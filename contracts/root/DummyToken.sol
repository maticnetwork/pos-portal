pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { EIP712MetaTransaction } from "../common/EIP712MetaTransaction.sol";

contract DummyToken is ERC20, EIP712MetaTransaction {
  constructor() 
    ERC20("Dummy Parent Token", "DUMMY")
    EIP712MetaTransaction("Dummy Parent Token", "1")
    public 
  {
    uint256 value = 10**10 * (10**18);
    _mint(_msgSender(), value);
  }

  function mint(uint256 supply) public {
    _mint(_msgSender(), supply);
  }
}
