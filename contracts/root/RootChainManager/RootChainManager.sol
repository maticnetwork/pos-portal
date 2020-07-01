pragma solidity ^0.6.6;

import {IRootChainManager} from "./IRootChainManager.sol";
import {IStateSender} from "../StateSender/IStateSender.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {MerklePatriciaProof} from "../../lib/MerklePatriciaProof.sol";
import {Merkle} from "../../lib/Merkle.sol";
import {ITokenPredicate} from "../TokenPredicates/ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract RootChainManager is IRootChainManager, Initializable, AccessControl {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using Merkle for bytes32;

    // maybe DEPOSIT and MAP_TOKEN can be reduced to bytes4
    bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 public constant MAP_TOKEN = keccak256("MAP_TOKEN");
    address public constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");

    // maybe typeToPredicate can be reduced to bytes4
    mapping(bytes32 => address) public typeToPredicate;
    mapping(address => address) public rootToChildToken;
    mapping(address => address) public childToRootToken;
    mapping(address => bytes32) public tokenToType;
    mapping(bytes32 => bool) public processedExits;

    IStateSender private _stateSender;
    ICheckpointManager private _checkpointManager;
    address public childChainManagerAddress;

    modifier only(bytes32 role) {
        require(
            hasRole(role, _msgSender()),
            "RootChainManager: INSUFFICIENT_PERMISSIONS"
        );
        _;
    }

    receive() external payable {
        _depositEtherFor(_msgSender());
    }

    function initialize(address _owner) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MAPPER_ROLE, _owner);
    }

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
        childChainManagerAddress = newChildChainManager;
    }

    function registerPredicate(bytes32 tokenType, address predicateAddress)
        external
        override
        only(MAPPER_ROLE)
    {
        typeToPredicate[tokenType] = predicateAddress;
        emit PredicateRegistered(tokenType, predicateAddress);
    }

    function mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external override only(MAPPER_ROLE) {
        require(
            typeToPredicate[tokenType] != address(0x0),
            "RootChainManager: TOKEN_TYPE_NOT_SUPPORTED"
        );

        rootToChildToken[rootToken] = childToken;
        childToRootToken[childToken] = rootToken;
        tokenToType[rootToken] = tokenType;

        emit TokenMapped(rootToken, childToken, tokenType);

        bytes memory syncData = abi.encode(rootToken, childToken, tokenType);
        _stateSender.syncState(
            childChainManagerAddress,
            abi.encode(MAP_TOKEN, syncData)
        );
    }

    function depositEtherFor(address user) external override payable {
        _depositEtherFor(user);
    }

    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external override {
        _depositFor(user, rootToken, depositData);
    }

    function _depositEtherFor(address user) private {
        bytes memory depositData = abi.encode(msg.value);
        _depositFor(user, ETHER_ADDRESS, depositData);

        // payable(typeToPredicate[tokenToType[ETHER_ADDRESS]]).transfer(msg.value);
        // transfer doesn't work as expected when receiving contract is proxified so using call
        (bool success, ) = typeToPredicate[tokenToType[ETHER_ADDRESS]].call{value: msg.value}("");
        if (!success) {
            revert("RootChainManager: ETHER_TRANSFER_FAILED");
        }
    }

    function _depositFor(
        address user,
        address rootToken,
        bytes memory depositData
    ) private {
        require(
            rootToChildToken[rootToken] != address(0x0) &&
               tokenToType[rootToken] != 0,
            "RootChainManager: TOKEN_NOT_MAPPED"
        );
        address predicateAddress = typeToPredicate[tokenToType[rootToken]];
        require(
            predicateAddress != address(0),
            "RootChainManager: INVALID_TOKEN_TYPE"
        );

        ITokenPredicate(predicateAddress).lockTokens(
            _msgSender(),
            user,
            rootToken,
            depositData
        );
        bytes memory syncData = abi.encode(user, rootToken, depositData);
        _stateSender.syncState(
            childChainManagerAddress,
            abi.encode(DEPOSIT, syncData)
        );
    }

    /**
     * @param inputData RLP encoded data of the reference tx containing following list of fields
     *  0 - headerNumber Header block number of which the reference tx was a part of
     *  1 - blockProof Proof that the block header (in the child chain) is a leaf in the submitted merkle root
     *  2 - blockNumber Block number of which the reference tx is a part of
     *  3 - blockTime Reference tx block time
     *  4 - blocktxRoot Transactions root of block
     *  5 - blockReceiptsRoot Receipts root of block
     *  6 - receipt Receipt of the reference transaction
     *  7 - receiptProof Merkle proof of the reference receipt
     *  8 - branchMask Merkle proof branchMask for the receipt
     *  9 - logIndex Log Index to read from the receipt
     */
    function exit(bytes calldata inputData) external override {
        RLPReader.RLPItem[] memory inputDataRLPList = inputData
            .toRlpItem()
            .toList();

        // checking if exit has already been processed
        // unique exit is identified using hash of (blockNumber, receipt, logIndex)
        bytes32 exitHash = keccak256(
            abi.encodePacked(
                inputDataRLPList[2].toBytes(), // blockNumber
                inputDataRLPList[6].toBytes(), // receipt
                inputDataRLPList[9].toUint() // logIndex
            )
        );
        require(
            processedExits[exitHash] == false,
            "RootChainManager: EXIT_ALREADY_PROCESSED"
        );
        processedExits[exitHash] = true;

        // verifying child withdraw log
        RLPReader.RLPItem[] memory receiptRLPList = inputDataRLPList[6]
            .toBytes()
            .toRlpItem()
            .toList();
        RLPReader.RLPItem memory logRLP = receiptRLPList[3]
            .toList()[inputDataRLPList[9].toUint()]; /* logIndex */

        address childToken = RLPReader.toAddress(logRLP.toList()[0]); // log emitter address field
        require(
            childToRootToken[childToken] != address(0),
            "RootChainManager: TOKEN_NOT_MAPPED"
        );

        address predicateAddress = typeToPredicate[
            tokenToType[
                childToRootToken[childToken]
            ]
        ];

        require(
            inputDataRLPList[8].toBytes().toRlpItem().toUint() &
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 ==
                0,
            "RootChainManager: INVALID_BRANCH_MASK"
        );

        // verify receipt inclusion
        require(
            MerklePatriciaProof.verify(
                inputDataRLPList[6].toBytes(), // receipt
                inputDataRLPList[8].toBytes(), // branchMask
                inputDataRLPList[7].toBytes(), // receiptProof
                bytes32(inputDataRLPList[5].toUint()) // receiptsRoot
            ),
            "RootChainManager: INVALID_PROOF"
        );

        // verify checkpoint inclusion
        _checkBlockMembershipInCheckpoint(
            inputDataRLPList[2].toUint(), // blockNumber
            inputDataRLPList[3].toUint(), // blockTime
            bytes32(inputDataRLPList[4].toUint()), // txRoot
            bytes32(inputDataRLPList[5].toUint()), // receiptRoot
            inputDataRLPList[0].toUint(), // headerNumber
            inputDataRLPList[1].toBytes() // blockProof
        );

        ITokenPredicate(predicateAddress).exitTokens(
            _msgSender(),
            childToRootToken[childToken],
            logRLP.toRlpBytes()
        );
    }

    function _checkBlockMembershipInCheckpoint(
        uint256 blockNumber,
        uint256 blockTime,
        bytes32 txRoot,
        bytes32 receiptRoot,
        uint256 headerNumber,
        bytes memory blockProof
    ) private view returns (uint256) {
        (
            bytes32 headerRoot,
            uint256 startBlock,
            ,
            uint256 createdAt,

        ) = _checkpointManager.headerBlocks(headerNumber);

        require(
            keccak256(
                abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot)
            )
                .checkMembership(
                blockNumber - startBlock,
                headerRoot,
                blockProof
            ),
            "RootChainManager: INVALID_HEADER"
        );
        return createdAt;
    }
}
