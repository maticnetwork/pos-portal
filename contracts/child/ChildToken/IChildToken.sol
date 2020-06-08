pragma solidity 0.6.6;


interface IChildToken {
  function deposit(address user, uint256 amount) external;
  function withdraw(uint256 amount) external;
}
