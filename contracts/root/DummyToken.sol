pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { NetworkAgnostic } from "../common/NetworkAgnostic.sol";

contract DummyToken is ERC20, NetworkAgnostic {
  constructor() 
    ERC20("Dummy Parent Token", "DUMMY")
    NetworkAgnostic("Dummy Parent Token", "1", 3)
    public 
  {
    uint256 value = 10**10 * (10**18);
    _mint(_msgSender(), value);
  }

  function _msgSender() internal view override(Context, NetworkAgnostic) returns (address payable) {
    return NetworkAgnostic._msgSender();
  }

  function mint(uint256 supply) public {
    _mint(_msgSender(), supply);
  }
}
