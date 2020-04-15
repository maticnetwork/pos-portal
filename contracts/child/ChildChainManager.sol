pragma solidity "0.6.6";

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import { IChildChainManager } from "./IChildChainManager.sol";
import { IChildToken } from "./IChildToken.sol";

contract ChildChainManager is IChildChainManager {
  mapping(address => address) private _rootToChildToken;
  mapping(address => address) private _childToRootToken;

  function rootToChildToken(address rootToken) public view returns (address) {
    return _rootToChildToken[rootToken];
  }

  function childToRootToken(address childToken) public view returns (address) {
    return _childToRootToken[childToken];
  }

  function mapToken(address rootToken, address childToken) override external {
    _rootToChildToken[rootToken] = childToken;
    _childToRootToken[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  function onStateReceive(uint256 id, bytes calldata data) override external {
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
