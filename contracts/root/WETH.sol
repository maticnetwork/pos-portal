pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  constructor() public ERC20("Wrapped Ether", "WETH") {}

  // deposit ETH by sending to this contract
  receive() external payable {
    deposit();
  }

  function deposit() public payable {
    _mint(_msgSender(), msg.value);
    emit Deposit(_msgSender(), msg.value);
  }

  function depositFor(address user) public payable {
    _mint(user, msg.value);
    _approve(user, _msgSender(), msg.value);
    emit Deposit(user, msg.value);
  }

  function withdraw(uint256 wad) public {
    require(balanceOf(_msgSender()) >= wad);
    _burn(_msgSender(), wad);
    _msgSender().transfer(wad);
    emit Withdrawal(_msgSender(), wad);
  }

  function withdrawFor(uint256 wad, address user) public {
    require(balanceOf(_msgSender()) >= wad);
    address(uint160(user)).transfer(wad);
    _burn(_msgSender(), wad);
    emit Withdrawal(user, wad);
  }
}
