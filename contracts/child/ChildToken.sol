pragma solidity "0.6.6";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IChildToken } from "./IChildToken.sol";
import { NetworkAgnostic } from "../common/NetworkAgnostic.sol";

contract ChildToken is ERC20, IChildToken, AccessControl, NetworkAgnostic {
  bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

  address private _rootToken;

  event Burned(
    address indexed rootToken,
    address indexed user,
    uint256 amount
  );

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) 
    public
    ERC20(name, symbol)
    NetworkAgnostic(name, "1", 15001)
  {
    _setupDecimals(decimals);
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(DEPOSITOR_ROLE, _msgSender());
  }

  modifier only(bytes32 role) {
    require(
      hasRole(role, _msgSender()),
      "Insufficient permissions"
    );
    _;
  }

  function setRootToken(address newRootToken) external only(DEFAULT_ADMIN_ROLE) {
    _rootToken = newRootToken;
  }

  function rootToken() public view returns (address) {
    return _rootToken;
  }
  
  function _msgSender() internal view override(Context, AccessControl, NetworkAgnostic) returns (address payable) {
    return NetworkAgnostic._msgSender();
  }

  function deposit(address user, uint256 amount) override external only(DEPOSITOR_ROLE) {
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
      amount <= balanceOf(_msgSender()),
      "withdraw amount cannot be more than balance"
    );

    _burn(_msgSender(), amount);
    emit Burned(_rootToken, _msgSender(), amount);
  }
}
