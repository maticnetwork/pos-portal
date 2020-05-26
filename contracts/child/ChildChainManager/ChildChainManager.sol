pragma solidity "0.6.6";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IChildChainManager } from "./IChildChainManager.sol";
import { IChildToken } from "../ChildToken/IChildToken.sol";

contract ChildChainManager is IChildChainManager, AccessControl {
  bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
  bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

  mapping(address => address) private _rootToChildToken;
  mapping(address => address) private _childToRootToken;

  constructor() public {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MAPPER_ROLE, _msgSender());
    _setupRole(STATE_SYNCER_ROLE, _msgSender());
  }

  modifier only(bytes32 role) {
    require(
      hasRole(role, _msgSender()),
      "Insufficient permissions"
    );
    _;
  }

  function rootToChildToken(address rootToken) public view returns (address) {
    return _rootToChildToken[rootToken];
  }

  function childToRootToken(address childToken) public view returns (address) {
    return _childToRootToken[childToken];
  }

  function mapToken(address rootToken, address childToken) override external only(MAPPER_ROLE) {
    _rootToChildToken[rootToken] = childToken;
    _childToRootToken[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  function onStateReceive(uint256 id, bytes calldata data) override external only(STATE_SYNCER_ROLE) {
    (address user, address rootToken, uint256 amount) = abi.decode(data, (address, address, uint256));
    address childTokenAddress = _rootToChildToken[rootToken];
    require(
      childTokenAddress != address(0x0),
      "Token not mapped"
    );
    IChildToken childTokenContract = IChildToken(childTokenAddress);
    childTokenContract.deposit(user, amount);
    emit Deposited(user, childTokenAddress, amount);
  }
}
