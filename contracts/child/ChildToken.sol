pragma solidity "0.6.6";

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "openzeppelin-solidity/contracts/access/AccessControl.sol";
import { IChildToken } from "./IChildToken.sol";

contract ChildToken is ERC20, IChildToken, AccessControl {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

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

    _setupRole(OWNER_ROLE, msg.sender);
    _setRoleAdmin(OWNER_ROLE, msg.sender);
    _setupRole(DEPOSITOR_ROLE, msg.sender);
    _setRoleAdmin(DEPOSITOR_ROLE, msg.sender);
  }

  modifier onlyOwner() {
    require(
      hasRole(OWNER_ROLE, msg.sender),
      "Insufficient permissions"
    );
    _;
  }

  modifier onlyDepositor() {
    require(
      hasRole(DEPOSITOR_ROLE, msg.sender),
      "Insufficient permissions"
    );
    _;
  }

  function transferOwnerRole(address newOwner) external onlyOwner {
    grantRole(OWNER_ROLE, newOwner);
    grantRole(DEPOSITOR_ROLE, newOwner);

    revokeRole(OWNER_ROLE, msg.sender);
    revokeRole(DEPOSITOR_ROLE, msg.sender);

    _setRoleAdmin(OWNER_ROLE, newOwner);
    _setRoleAdmin(DEPOSITOR_ROLE, newOwner);
  }

  function rootToken() public view returns (address) {
    return _rootToken;
  }

  function deposit(address user, uint256 amount) override external onlyDepositor {
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
