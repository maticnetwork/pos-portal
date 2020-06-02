pragma solidity "0.6.6";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ChildChainManagerStorage } from "./ChildChainManagerStorage.sol";
import { IChildChainManager } from "./IChildChainManager.sol";
import { IChildToken } from "../ChildToken/IChildToken.sol";

contract ChildChainManager is IChildChainManager, ChildChainManagerStorage {
  constructor() public ChildChainManagerStorage() {}

  function rootToChildToken(address rootToken) public view override returns (address) {
    return _rootToChildToken[rootToken];
  }

  function childToRootToken(address childToken) public view override returns (address) {
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
      "ChildChainManager: TOKEN_NOT_MAPPED"
    );
    IChildToken childTokenContract = IChildToken(childTokenAddress);
    childTokenContract.deposit(user, amount);
    emit Deposited(user, childTokenAddress, amount);
  }
}
