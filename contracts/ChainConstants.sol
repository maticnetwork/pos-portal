pragma solidity >=0.4.21 <0.7.0;

contract ChainConstants {
    uint256 constant public ROOT_CHAIN_ID = 5;
    bytes constant public ROOT_CHAIN_ID_BYTES = hex"05";

    uint256 constant public CHILD_CHAIN_ID = 15001;
    bytes constant public CHILD_CHAIN_ID_BYTES = hex"3A99";
}
