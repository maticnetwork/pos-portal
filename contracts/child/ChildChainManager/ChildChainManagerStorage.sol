pragma solidity 0.6.6;

contract ChildChainManagerStorage {
    mapping(address => address) public rootToChildToken;
    mapping(address => address) public childToRootToken;
}
