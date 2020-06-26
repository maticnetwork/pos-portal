
// File: contracts/root/StateSender/DummyStateSender.sol

pragma solidity 0.6.6;

contract DummyStateSender {
    event StateSynced(
        uint256 indexed id,
        address indexed contractAddress,
        bytes data
    );

    function syncState(address receiver, bytes calldata data) external {
        emit StateSynced(1, receiver, data);
    }
}
