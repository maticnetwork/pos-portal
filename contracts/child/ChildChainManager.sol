pragma solidity "0.6.6";

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "openzeppelin-solidity/contracts/access/AccessControl.sol";
import { IChildChainManager } from "./IChildChainManager.sol";
import { IChildToken } from "./IChildToken.sol";

contract ChildChainManager is IChildChainManager, AccessControl {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
  bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

  mapping(address => address) private _rootToChildToken;
  mapping(address => address) private _childToRootToken;

  constructor() public {
    _setupRole(OWNER_ROLE, msg.sender);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
    _setupRole(MAPPER_ROLE, msg.sender);
    _setRoleAdmin(MAPPER_ROLE, OWNER_ROLE);
    _setupRole(STATE_SYNCER_ROLE, msg.sender);
    _setRoleAdmin(STATE_SYNCER_ROLE, OWNER_ROLE);
  }

  modifier onlyOwner() {
    require(
      hasRole(OWNER_ROLE, msg.sender),
      "Insufficient permissions"
    );
    _;
  }

  modifier onlyMapper() {
    require(
      hasRole(MAPPER_ROLE, msg.sender),
      "Insufficient permissions"
    );
    _;
  }

  modifier onlyStateSyncer() {
    require(
      hasRole(STATE_SYNCER_ROLE, msg.sender),
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

  function mapToken(address rootToken, address childToken) override external onlyMapper {
    _rootToChildToken[rootToken] = childToken;
    _childToRootToken[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  function onStateReceive(uint256 id, bytes calldata data) override external onlyStateSyncer {
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
