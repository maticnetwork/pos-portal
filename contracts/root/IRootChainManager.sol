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

  function setStateSender(address newStateSender) external;

  function mapToken(address rootToken, address childToken) external;

  function depositEther() external payable;

  function depositEtherFor(address user) external payable;

  function deposit(address rootToken, uint256 amount) external;

  function depositFor(address user, address rootToken, uint256 amount) external;

  function exit(bytes calldata data) external;
}
