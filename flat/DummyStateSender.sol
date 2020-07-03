
// File: contracts/root/StateSender/IStateSender.sol

pragma solidity ^0.6.6;

interface IStateSender {
    function syncState(address receiver, bytes calldata data) external;
}

// File: contracts/root/StateSender/DummyStateSender.sol

pragma solidity ^0.6.6;



contract DummyStateSender is IStateSender {
    event StateSynced(
        uint256 indexed id,
        address indexed contractAddress,
        bytes data
    );

    function syncState(address receiver, bytes calldata data) external override {
        emit StateSynced(1, receiver, data);
    }
}
