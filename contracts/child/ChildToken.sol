pragma solidity "0.6.6";

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { IChildToken } from "./IChildToken.sol";

contract ChildToken is ERC20, IChildToken {
  address private _rootToken;

  constructor(
    address rootToken,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20(name, symbol) {
    require(
      rootToken != address(0x0),
      "Need root token address"
    );
    _setupDecimals(decimals);
    _rootToken = rootToken;
  }

  function rootToken() public view returns (address) {
    return _rootToken;
  }

  function deposit(address user, uint256 amount) override external {
    require(
      amount > 0,
      "amount should be possitive"
    );
    require(
      user != address(0x0),
      "Cannot deposit for zero address"
    );
    _mint(user, amount);
  }

  function withdraw(uint256 amount) override external {
    require(
      amount > 0,
      "withdraw amount should be positie"
    );
    require(
      amount <= balanceOf(msg.sender),
      "withdraw amount cannot be more than balance"
    );

    _burn(msg.sender, amount);
    emit Burned(_rootToken, msg.sender, amount);
  }
}
