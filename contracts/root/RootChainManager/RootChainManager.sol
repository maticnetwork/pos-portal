pragma solidity 0.6.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IRootChainManager} from "./IRootChainManager.sol";
import {RootChainManagerStorage} from "./RootChainManagerStorage.sol";
import {IStateSender} from "../StateSender/IStateSender.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {MerklePatriciaProof} from "../../lib/MerklePatriciaProof.sol";
import {Merkle} from "../../lib/Merkle.sol";
import {ITokenPredicate} from "../TokenPredicates/ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract RootChainManager is
    IRootChainManager,
    Initializable,
    AccessControl, // included to match old storage layout while upgrading
    RootChainManagerStorage, // created to match old storage layout while upgrading
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using Merkle for bytes32;
    using SafeMath for uint256;

    // maybe DEPOSIT and MAP_TOKEN can be reduced to bytes4
    bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 public constant MAP_TOKEN = keccak256("MAP_TOKEN");
    address public constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    /**
     * @notice Deposit ether by directly sending to the contract
     * The account sending ether receives WETH on child chain
     */
    receive() external payable {
        _depositEtherFor(_msgSender());
    }

    /**
     * @notice Initialize the contract after it has been proxified
     * @dev meant to be called once immediately after deployment
     * @param _owner the account that should be granted admin role
     */
    function initialize(
        address _owner
    )
        external
        initializer
    {
        _initializeEIP712("RootChainManager");
        _setupContractId("RootChainManager");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MAPPER_ROLE, _owner);
    }

    // adding seperate function setupContractId since initialize is already called with old implementation
    function setupContractId()
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _setupContractId("RootChainManager");
    }

    // adding seperate function initializeEIP712 since initialize is already called with old implementation
    function initializeEIP712()
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _setDomainSeperator("RootChainManager");
    }

    /**
     * @notice Set the state sender, callable only by admins
     * @dev This should be the state sender from plasma contracts
     * It is used to send bytes from root to child chain
     * @param newStateSender address of state sender contract
     */
    function setStateSender(address newStateSender)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _stateSender = IStateSender(newStateSender);
    }

    /**
     * @notice Get the address of contract set as state sender
     * @return The address of state sender contract
     */
    function stateSenderAddress() external view returns (address) {
        return address(_stateSender);
    }

    /**
     * @notice Set the checkpoint manager, callable only by admins
     * @dev This should be the plasma contract responsible for keeping track of checkpoints
     * @param newCheckpointManager address of checkpoint manager contract
     */
    function setCheckpointManager(address newCheckpointManager)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _checkpointManager = ICheckpointManager(newCheckpointManager);
    }

    /**
     * @notice Get the address of contract set as checkpoint manager
     * @return The address of checkpoint manager contract
     */
    function checkpointManagerAddress() external view returns (address) {
        return address(_checkpointManager);
    }

    /**
     * @notice Set the child chain manager, callable only by admins
     * @dev This should be the contract responsible to receive deposit bytes on child chain
     * @param newChildChainManager address of child chain manager contract
     */
    function setChildChainManagerAddress(address newChildChainManager)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        require(newChildChainManager != address(0x0), "RootChainManager: INVALID_CHILD_CHAIN_ADDRESS");
        childChainManagerAddress = newChildChainManager;
    }

    /**
     * @notice Register a token predicate address against its type, callable only by mappers
     * @dev A predicate is a contract responsible to process the token specific logic while locking or exiting tokens
     * @param tokenType bytes32 unique identifier for the token type
     * @param predicateAddress address of token predicate address
     */
    function registerPredicate(bytes32 tokenType, address predicateAddress)
        external
        override
        only(MAPPER_ROLE)
    {
        typeToPredicate[tokenType] = predicateAddress;
        emit PredicateRegistered(tokenType, predicateAddress);
    }

    /**
     * @notice Map a token to enable its movement via the PoS Portal, callable only by mappers
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     * @param tokenType bytes32 unique identifier for the token type
     */
    function mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external override only(MAPPER_ROLE) {
        // explicit check if token is already mapped to avoid accidental remaps
        require(
            rootToChildToken[rootToken] == address(0) &&
            childToRootToken[childToken] == address(0),
            "RootChainManager: ALREADY_MAPPED"
        );
        _mapToken(rootToken, childToken, tokenType);
    }

    /**
     * @notice Clean polluted token mapping
     * @param rootToken address of token on root chain. Since rename token was introduced later stage, 
     * clean method is used to clean pollulated mapping
     */
    function cleanMapToken(
        address rootToken,
        address childToken
    ) external override only(MAPPER_ROLE) {
        rootToChildToken[rootToken] = address(0);
        childToRootToken[childToken] = address(0);
        tokenToType[rootToken] = bytes32(0);

        emit TokenMapped(rootToken, childToken, tokenToType[rootToken]);
    }

    /**
     * @notice Remap a token that has already been mapped, properly cleans up old mapping
     * Callable only by mappers
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     * @param tokenType bytes32 unique identifier for the token type
     */
    function remapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external override only(MAPPER_ROLE) {
        // cleanup old mapping
        address oldChildToken = rootToChildToken[rootToken];
        address oldRootToken = childToRootToken[childToken];

        if (rootToChildToken[oldRootToken] != address(0)) {
            rootToChildToken[oldRootToken] = address(0);
            tokenToType[oldRootToken] = bytes32(0);
        }

        if (childToRootToken[oldChildToken] != address(0)) {
            childToRootToken[oldChildToken] = address(0);
        }

        _mapToken(rootToken, childToken, tokenType);
    }

    function _mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) private {
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

    /**
     * @notice Move ether from root to child chain, accepts ether transfer
     * Keep in mind this ether cannot be used to pay gas on child chain
     * Use Matic tokens deposited using plasma mechanism for that
     * @param user address of account that should receive WETH on child chain
     */
    function depositEtherFor(address user) external override payable {
        _depositEtherFor(user);
    }

    /**
     * @notice Move tokens from root to child chain
     * @dev This mechanism supports arbitrary tokens as long as its predicate has been registered and the token is mapped
     * @param user address of account that should receive this deposit on child chain
     * @param rootToken address of token that is being deposited
     * @param depositData bytes data that is sent to predicate and child token contracts to handle deposit
     */
    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external override {
        require(
            rootToken != ETHER_ADDRESS,
            "RootChainManager: INVALID_ROOT_TOKEN"
        );
        _depositFor(user, rootToken, depositData);
    }

    function _depositEtherFor(address user) private {
        bytes memory depositData = abi.encode(msg.value);
        _depositFor(user, ETHER_ADDRESS, depositData);

        // payable(typeToPredicate[tokenToType[ETHER_ADDRESS]]).transfer(msg.value);
        // transfer doesn't work as expected when receiving contract is proxified so using call
        (bool success, /* bytes memory data */) = typeToPredicate[tokenToType[ETHER_ADDRESS]].call{value: msg.value}("");
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
        require(
            user != address(0),
            "RootChainManager: INVALID_USER"
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
     * @notice exit tokens by providing proof
     * @dev This function verifies if the transaction actually happened on child chain
     * the transaction log is then sent to token predicate to handle it accordingly
     *
     * @param inputData RLP encoded data of the reference tx containing following list of fields
     *  0 - headerNumber - Checkpoint header block number containing the reference tx
     *  1 - blockProof - Proof that the block header (in the child chain) is a leaf in the submitted merkle root
     *  2 - blockNumber - Block number containing the reference tx on child chain
     *  3 - blockTime - Reference tx block time
     *  4 - txRoot - Transactions root of block
     *  5 - receiptRoot - Receipts root of block
     *  6 - receipt - Receipt of the reference transaction
     *  7 - receiptProof - Merkle proof of the reference receipt
     *  8 - branchMask - 32 bits denoting the path of receipt in merkle tree
     *  9 - receiptLogIndex - Log Index to read from the receipt
     */
    function exit(bytes calldata inputData) external override {
        RLPReader.RLPItem[] memory inputDataRLPList = inputData
            .toRlpItem()
            .toList();

        // checking if exit has already been processed
        // unique exit is identified using hash of (blockNumber, branchMask, receiptLogIndex)
        bytes32 exitHash = keccak256(
            abi.encodePacked(
                inputDataRLPList[2].toUint(), // blockNumber
                // first 2 nibbles are dropped while generating nibble array
                // this allows branch masks that are valid but bypass exitHash check (changing first 2 nibbles only)
                // so converting to nibble array and then hashing it
                MerklePatriciaProof._getNibbleArray(inputDataRLPList[8].toBytes()), // branchMask
                inputDataRLPList[9].toUint() // receiptLogIndex
            )
        );
        require(
            processedExits[exitHash] == false,
            "RootChainManager: EXIT_ALREADY_PROCESSED"
        );
        processedExits[exitHash] = true;

        RLPReader.RLPItem[] memory receiptRLPList = inputDataRLPList[6]
            .toBytes()
            .toRlpItem()
            .toList();
        RLPReader.RLPItem memory logRLP = receiptRLPList[3]
            .toList()[
                inputDataRLPList[9].toUint() // receiptLogIndex
            ];

        address childToken = RLPReader.toAddress(logRLP.toList()[0]); // log emitter address field
        // log should be emmited only by the child token
        address rootToken = childToRootToken[childToken];
        require(
            rootToken != address(0),
            "RootChainManager: TOKEN_NOT_MAPPED"
        );

        address predicateAddress = typeToPredicate[
            tokenToType[rootToken]
        ];

        // branch mask can be maximum 32 bits
        require(
            inputDataRLPList[8].toUint() &
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
                bytes32(inputDataRLPList[5].toUint()) // receiptRoot
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
                blockNumber.sub(startBlock),
                headerRoot,
                blockProof
            ),
            "RootChainManager: INVALID_HEADER"
        );
        return createdAt;
    }
}
