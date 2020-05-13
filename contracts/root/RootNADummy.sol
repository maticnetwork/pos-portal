pragma solidity >=0.4.21 <0.7.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { EIP712MetaTransaction } from "../common/EIP712.sol";

contract RootNADummy is ERC20, EIP712MetaTransaction {
  constructor()
    ERC20("RootNADummy", "NADUMMY")
    EIP712MetaTransaction("RootNADummy", "1")
    public
  {
    uint256 initialSupply = 10**10 * (10**18);
    _mint(_msgSender(), initialSupply);
  }

  function mint(uint256 supply) public {
    _mint(_msgSender(), supply);
  }
}
