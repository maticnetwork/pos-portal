pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { NetworkAgnostic } from "../common/NetworkAgnostic.sol";

contract DummyToken is ERC20, NetworkAgnostic {
  constructor(string memory name, string memory symbol) 
    ERC20(name, symbol)
    NetworkAgnostic(name, "1", getChainId())
    public 
  {
    uint256 value = 10**10 * (10**18);
    _mint(_msgSender(), value);
  }

  function getChainId() public pure returns (uint id) {
    assembly {
      id := chainid()
    }
  }

  function _msgSender() internal view override(Context, NetworkAgnostic) returns (address payable) {
    return NetworkAgnostic._msgSender();
  }

  function mint(uint256 supply) public {
    _mint(_msgSender(), supply);
  }
}
