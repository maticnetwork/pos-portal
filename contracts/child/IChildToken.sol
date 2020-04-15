pragma solidity 0.6.6;


interface IChildToken {
  event Burned(
    address indexed rootToken,
    address indexed user,
    uint256 amount
  );

  function deposit(address user, uint256 amount) external;

  function withdraw(uint256 amount) external;
}
