pragma solidity 0.6.6;

interface IChildChainManager {
    event TokenMapped(address indexed rootToken, address indexed childToken);
    event TokenUnmapped(address indexed rootToken, address indexed childToken);

    function mapToken(address rootToken, address childToken) external;
    function cleanMapToken(address rootToken, address childToken) external;
}
