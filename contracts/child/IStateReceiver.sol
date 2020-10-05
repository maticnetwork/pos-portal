pragma solidity 0.6.6;

interface IStateReceiver {
    function onStateReceive(uint256 id, bytes calldata data) external;
}
