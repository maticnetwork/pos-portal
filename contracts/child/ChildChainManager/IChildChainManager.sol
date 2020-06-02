pragma solidity 0.6.6;


interface IChildChainManager {
  event TokenMapped(
    address indexed rootToken,
    address indexed childToken
  );

  event Deposited(
    address indexed user,
    address indexed childToken,
    uint256 indexed amount
  );

  function mapToken(address rootToken, address childToken) external;
  function rootToChildToken(address rootToken) external view returns (address);
  function childToRootToken(address childToken) external view returns (address);

  function onStateReceive(uint256 id, bytes calldata data) external;
}
