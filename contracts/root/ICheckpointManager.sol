pragma solidity "0.6.6";

contract ICheckpointManager {
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
    address proposer;
  }
  mapping(uint256 => HeaderBlock) public headerBlocks;
}
