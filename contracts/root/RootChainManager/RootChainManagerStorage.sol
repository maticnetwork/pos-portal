pragma solidity 0.6.6;

import {IStateSender} from "../StateSender/IStateSender.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";

abstract contract RootChainManagerStorage {
    mapping(bytes32 => address) public typeToPredicate;
    mapping(address => address) public rootToChildToken;
    mapping(address => address) public childToRootToken;
    mapping(address => bytes32) public tokenToType;
    mapping(bytes32 => bool) public processedExits;
    IStateSender internal _stateSender;
    ICheckpointManager internal _checkpointManager;
    address public childChainManagerAddress;
}
