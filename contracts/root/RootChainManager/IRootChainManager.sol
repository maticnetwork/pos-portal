pragma solidity "0.6.6";

interface IRootChainManager {
  event TokenMapped(
    address indexed rootToken,
    address indexed childToken
  );

  event Locked(
    address indexed user,
    address indexed rootToken,
    uint256 indexed amount
  );

  event Exited(
    address indexed user,
    address indexed rootToken,
    uint256 indexed amount
  );

  function mapToken(address rootToken, address childToken) external;
  function rootToChildToken(address rootToken) external view returns (address);
  function childToRootToken(address childToken) external view returns (address);

  function processedExits(bytes32 exitHash) external view returns (bool);

  function depositEther() external payable;

  function depositEtherFor(address user) external payable;

  function deposit(address rootToken, uint256 amount) external;

  function depositFor(address user, address rootToken, uint256 amount) external;

  function exit(bytes calldata data) external;
}
