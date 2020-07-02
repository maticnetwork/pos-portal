pragma solidity 0.6.6;

import {IStateSender} from "../StateSender/IStateSender.sol";


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
