pragma solidity >=0.4.21 <0.7.0;

import { ChildToken } from "./ChildToken.sol";
import { EIP712MetaTransaction } from "../common/EIP712MetaTransaction.sol";

contract ChildNADummy is ChildToken, EIP712MetaTransaction {
  constructor()
    ChildToken("ChildNADummy", "NADUMMY", 18)
    EIP712MetaTransaction("ChildNADummy", "1")
    public
  {
    uint256 initialSupply = 10**10 * (10**18);
    _mint(_msgSender(), initialSupply);
  }

  function mint(uint256 supply) public {
    _mint(_msgSender(), supply);
  }
}
