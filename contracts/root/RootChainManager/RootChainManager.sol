pragma solidity ^0.6.6;

import {IRootChainManager} from "./IRootChainManager.sol";
import {RootChainManagerStorage} from "./RootChainManagerStorage.sol";

import {IStateSender} from "../StateSender/IStateSender.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import {WETH} from "../RootToken/WETH.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {MerklePatriciaProof} from "../../lib/MerklePatriciaProof.sol";
import {Merkle} from "../../lib/Merkle.sol";
import {ITokenPredicate} from "../TokenPredicates/ITokenPredicate.sol";


contract RootChainManager is RootChainManagerStorage, IRootChainManager {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using Merkle for bytes32;

    bytes32 private constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 private constant MAP_TOKEN = keccak256("MAP_TOKEN");
    IStateSender private _stateSender;
    ICheckpointManager private _checkpointManager;
    address private _childChainManagerAddress;

    // TODO: add fallback function

    function setStateSender(address newStateSender)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _stateSender = IStateSender(newStateSender);
    }

    function stateSenderAddress() external view returns (address) {
        return address(_stateSender);
    }

    function setCheckpointManager(address newCheckpointManager)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _checkpointManager = ICheckpointManager(newCheckpointManager);
    }

    function checkpointManagerAddress() external view returns (address) {
        return address(_checkpointManager);
    }

    function setChildChainManagerAddress(address newChildChainManager)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _childChainManagerAddress = newChildChainManager;
    }

    function childChainManagerAddress() external view returns (address) {
        return _childChainManagerAddress;
    }

    function registerPredicate(bytes32 tokenType, address predicateAddress)
        external
        override
        only(REGISTERER_ROLE)
    {
        _typeToPredicate[tokenType] = predicateAddress;
        emit PredicateRegistered(tokenType, predicateAddress);
    }

    function typeToPredicate(bytes32 tokenType) external view override returns (address) {
        return _typeToPredicate[tokenType];
    }

    function mapToken(address rootToken, address childToken, bytes32 tokenType)
        external
        override
        only(MAPPER_ROLE)
    {
        require(
            _typeToPredicate[tokenType] != address(0x0),
            "RootChainManager: TOKEN_TYPE_NOT_SUPPORTED"
        );
        require(
            address(_stateSender) != address(0x0),
            "RootChainManager: STATESENDER_NOT_SET"
        );
        require(
            address(_childChainManagerAddress) != address(0x0),
            "RootChainManager: CHILDCHAINMANAGER_NOT_SET"
        );

        _rootToChildToken[rootToken] = childToken;
        _childToRootToken[childToken] = rootToken;
        _tokenToType[rootToken] = tokenType;

        emit TokenMapped(rootToken, childToken, tokenType);

        bytes memory syncData = abi.encode(rootToken, childToken, tokenType);
        _stateSender.syncState(_childChainManagerAddress, abi.encode(MAP_TOKEN, syncData));
    }

    function rootToChildToken(address rootToken)
        external
        override
        view
        returns (address)
    {
        return _rootToChildToken[rootToken];
    }

    function childToRootToken(address childToken)
        external
        override
        view
        returns (address)
    {
        return _childToRootToken[childToken];
    }

    function tokenToType(address rootToken)
        external
        override
        view
        returns (bytes32)
    {
        return _tokenToType[rootToken];
    }

    function depositEtherFor(address user, uint256 amount) external payable override {

    }

    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    )
        external
        override
    {
        require(
            address(_stateSender) != address(0x0),
            "RootChainManager: STATESENDER_NOT_SET"
        );
        require(
            address(_childChainManagerAddress) != address(0x0),
            "RootChainManager: CHILDCHAINMANAGER_NOT_SET"
        );
        require(
            _rootToChildToken[rootToken] != address(0x0) && _tokenToType[rootToken] != 0,
            "RootChainManager: TOKEN_NOT_MAPPED"
        );
        address predicateAddress = _typeToPredicate[_tokenToType[rootToken]];
        require(
            predicateAddress != address(0),
            "RootChainManager: INVALID_TOKEN_TYPE"
        );

        ITokenPredicate(predicateAddress).lockTokens(_msgSender(), user, rootToken, depositData);
        bytes memory syncData = abi.encode(user, rootToken, depositData);
        _stateSender.syncState(_childChainManagerAddress, abi.encode(DEPOSIT, syncData));
    }

    function processedExits(bytes32 exitHash)
        external
        override
        view
        returns (bool)
    {
        return _processedExits[exitHash];
    }

    function exit(bytes calldata data) external override {

    }
}
