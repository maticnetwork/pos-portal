pragma solidity "0.6.6";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IRootChainManager } from "./IRootChainManager.sol";
import { RootChainManagerStorage } from "./RootChainManagerStorage.sol";

import { IStateSender } from "../StateSender/IStateSender.sol";
import { ICheckpointManager } from '../ICheckpointManager.sol';
import { WETH } from '../RootToken/WETH.sol';
import { RLPReader } from "../../lib/RLPReader.sol";
import { MerklePatriciaProof } from "../../lib/MerklePatriciaProof.sol";
import { Merkle } from "../../lib/Merkle.sol";

contract RootChainManager is IRootChainManager, RootChainManagerStorage {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  // Transfer(address,address,uint256)
  bytes32 constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

  IStateSender private _stateSender;
  ICheckpointManager private _checkpointManager;
  address private _childChainManagerAddress;
  WETH private _WETH;

  constructor() public RootChainManagerStorage() {}

  receive() external payable {
    depositEther();
  }

  function setStateSender(address newStateSender) external only(DEFAULT_ADMIN_ROLE) {
    _stateSender = IStateSender(newStateSender);
  }

  function stateSenderAddress() external view returns (address) {
    return address(_stateSender);
  }

  function setCheckpointManager(address newCheckpointManager) external only(DEFAULT_ADMIN_ROLE) {
    _checkpointManager = ICheckpointManager(newCheckpointManager);
  }

  function checkpointManagerAddress() external view returns (address) {
    return address(_checkpointManager);
  }

  function setChildChainManagerAddress(address newChildChainManager) external only(DEFAULT_ADMIN_ROLE) {
    _childChainManagerAddress = newChildChainManager;
  }

  function childChainManagerAddress() external view returns (address) {
    return _childChainManagerAddress;
  }

  function setWETH(address payable newWETHAddress) external only(DEFAULT_ADMIN_ROLE) {
    _WETH = WETH(newWETHAddress);
  }

  function WETHAddress() external view returns (address) {
    return address(_WETH);
  }

  function mapToken(address rootToken, address childToken) external override only(MAPPER_ROLE) {
    _rootToChildToken[rootToken] = childToken;
    _childToRootToken[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  function rootToChildToken(address rootToken) public view override returns (address) {
    return _rootToChildToken[rootToken];
  }

  function childToRootToken(address childToken) public view override returns (address) {
    return _childToRootToken[childToken];
  }

  function processedExits(bytes32 exitHash) public view override returns (bool) {
    return _processedExits[exitHash];
  }

  function depositEther() override public payable {
    require(
      address(_WETH) != address(0x0),
      "RootChainManager: WETH_NOT_SET"
    );
    _WETH.depositFor.value(msg.value)(_msgSender());
    _depositFor(_msgSender(), address(_WETH), msg.value);
  }

  function depositEtherFor(address user) override external payable {
    require(
      address(_WETH) != address(0x0),
      "RootChainManager: WETH_NOT_SET"
    );
    _WETH.depositFor.value(msg.value)(user);
    _depositFor(user, address(_WETH), msg.value);
  }

  function deposit(address rootToken, uint256 amount) override external {
    _depositFor(_msgSender(), rootToken, amount);
  }

  function depositFor(address user, address rootToken, uint256 amount) override external {
    _depositFor(user, rootToken, amount);
  }

  function _depositFor(address user, address rootToken, uint256 amount) private {
    require(
      _rootToChildToken[rootToken] != address(0x0),
      "RootChainManager: TOKEN_NOT_MAPPED"
    );
    require(
      IERC20(rootToken).allowance(_msgSender(), address(this)) >= amount,
      "RootChainManager: TRANSFER_NOT_APPROVED"
    );
    require(
      address(_stateSender) != address(0x0),
      "RootChainManager: STATESENDER_NOT_SET"
    );
    require(
      address(_childChainManagerAddress) != address(0x0),
      "RootChainManager: CHILDCHAINMANAGER_NOT_SET"
    );

    IERC20(rootToken).transferFrom(_msgSender(), address(this), amount);
    _stateSender.syncState(_childChainManagerAddress, abi.encode(user, rootToken, amount));
    emit Locked(user, rootToken, amount);
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
  function exit(bytes calldata inputData) override external {
    RLPReader.RLPItem[] memory inputDataRLPList = inputData.toRlpItem().toList();

    require(
      _processedExits[
        keccak256(abi.encodePacked(
          inputDataRLPList[2].toBytes(), // blockNumber
          inputDataRLPList[6].toBytes(), // receipt
          inputDataRLPList[9].toBytes() // logIndex
        ))
      ] == false,
      "RootChainManager: EXIT_ALREADY_PROCESSED"
    );
    _processedExits[
      keccak256(abi.encodePacked(
        inputDataRLPList[2].toBytes(), // blockNumber
        inputDataRLPList[6].toBytes(), // receipt
        inputDataRLPList[9].toBytes() // logIndex
      ))
    ] = true;

    uint256 logIndex = inputDataRLPList[9].toUint();
    bytes memory receipt = inputDataRLPList[6].toBytes();
    RLPReader.RLPItem[] memory receiptRLPList = receipt.toRlpItem().toList();
    RLPReader.RLPItem[] memory logRLPList = receiptRLPList[3].toList()[logIndex].toList();

    address childToken = RLPReader.toAddress(logRLPList[0]); // log address field
    require(
      _childToRootToken[childToken] != address(0),
      "RootChainManager: TOKEN_NOT_MAPPED"
    );

    RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
    require(
      bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is event sig
      "RootChainManager: INVALID_SIGNATURE"
    );
    require(
      _msgSender() == address(logTopicRLPList[1].toUint()), // from1 is from address
      "RootChainManager: INVALID_SENDER"
    );
    require(
      address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
      "RootChainManager: INVALID_RECEIVER"
    );

    // TODO: verify tx inclusion
    // required?

    require(
      inputDataRLPList[8].toBytes().toRlpItem().toUint() &
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 ==
        0,
      "RootChainManager: INVALID_BRANCH_MASK"
    );

    uint256 headerNumber = inputDataRLPList[0].toUint();
    require(
      MerklePatriciaProof.verify(
        inputDataRLPList[6].toBytes(), // receipt
        inputDataRLPList[8].toBytes(), // branchMask
        inputDataRLPList[7].toBytes(), // receiptProof
        bytes32(inputDataRLPList[5].toUint()) // receiptsRoot
      ),
      "RootChainManager: INVALID_PROOF"
    );

    checkBlockMembershipInCheckpoint(
      inputDataRLPList[2].toUint(), // blockNumber
      inputDataRLPList[3].toUint(), // blockTime
      bytes32(inputDataRLPList[4].toUint()), // txRoot
      bytes32(inputDataRLPList[5].toUint()), // receiptRoot
      headerNumber,
      inputDataRLPList[1].toBytes() // blockProof
    );

    IERC20(
      _childToRootToken[childToken]
    ).transfer(_msgSender(), logRLPList[2].toUint());

    if (_childToRootToken[childToken] == address(_WETH)) {
      _WETH.withdrawFor(logRLPList[2].toUint(), _msgSender());
    }

    emit Exited(_msgSender(), _childToRootToken[childToken], logRLPList[2].toUint());
  }

  function checkBlockMembershipInCheckpoint(
    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    uint256 headerNumber,
    bytes memory blockProof
  )
    internal
    view
    returns (uint256 /* createdAt */)
  {
    (bytes32 headerRoot, uint256 startBlock, , uint256 createdAt, ) =
      _checkpointManager.headerBlocks(headerNumber);

    require(
      keccak256(
        abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot)
      ).checkMembership(
        blockNumber - startBlock,
        headerRoot,
        blockProof
      ),
      "RootChainManager: INVALID_HEADER"
    );
    return createdAt;
  }
}
