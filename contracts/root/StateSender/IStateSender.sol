pragma solidity 0.6.6;

interface IStateSender {
    function syncState(address receiver, bytes calldata data) external;
}
