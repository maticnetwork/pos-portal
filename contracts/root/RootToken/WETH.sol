pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract WETH is ERC20, AccessControl {
  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  bytes32 public constant ROOT_CHAIN_MANAGER_ROLE = keccak256("ROOT_CHAIN_MANAGER_ROLE");

  constructor() public ERC20("Wrapped Ether", "WETH") {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(ROOT_CHAIN_MANAGER_ROLE, _msgSender());
  }

  modifier only(bytes32 role) {
    require(
      hasRole(role, _msgSender()),
      "Insufficient permissions"
    );
    _;
  }

  function depositFor(address user) external payable only(ROOT_CHAIN_MANAGER_ROLE) {
    _mint(user, msg.value);
    _approve(user, _msgSender(), msg.value);
    emit Deposit(user, msg.value);
  }

  function withdrawFor(uint256 amount, address user) external only(ROOT_CHAIN_MANAGER_ROLE) {
    require(balanceOf(user) >= amount, "Insufficient WETH balance");
    address(uint160(user)).transfer(amount);
    _burn(user, amount);
    emit Withdrawal(user, amount);
  }
}
