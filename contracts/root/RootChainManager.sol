pragma solidity "0.6.6";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IRootChainManager } from "./IRootChainManager.sol";
import { IStateSender } from "./IStateSender.sol";
import { ICheckpointManager } from './ICheckpointManager.sol';
import { WETH } from './WETH.sol';
import { RLPReader } from "../lib/RLPReader.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";
import { Merkle } from "../lib/Merkle.sol";

contract RootChainManager is IRootChainManager, AccessControl {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;
  using Merkle for bytes32;

  // Transfer(address,address,uint256)
  bytes32 constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
  bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");

  IStateSender private _stateSender;
  ICheckpointManager private _checkpointManager;
  WETH private _WETH;
  address private _childChainManagerAddress;
  mapping(address => address) private _rootToChildToken;
  mapping(address => address) private _childToRootToken;
  mapping(bytes32 => bool) private _exitedTxs;

  constructor() public {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(MAPPER_ROLE, msg.sender);
  }

  modifier only(bytes32 role) {
    require(
      hasRole(role, msg.sender),
      "Insufficient permissions"
    );
    _;
  }

  function setStateSender(address newStateSender) override external only(DEFAULT_ADMIN_ROLE) {
    _stateSender = IStateSender(newStateSender);
  }

  function stateSenderAddress() public view returns (address) {
    return address(_stateSender);
  }

  function setCheckpointManager(address newCheckpointManager) override external only(DEFAULT_ADMIN_ROLE) {
    _checkpointManager = ICheckpointManager(newCheckpointManager);
  }

  function checkpointManagerAddress() public view returns (address) {
    return address(_checkpointManager);
  }

  function setChildChainManagerAddress(address newChildChainManager) external only(DEFAULT_ADMIN_ROLE) {
    _childChainManagerAddress = newChildChainManager;
  }

  function childChainManagerAddress() public view returns (address) {
    return _childChainManagerAddress;
  }

  function setWETH(address payable newWETHAddress) external only(DEFAULT_ADMIN_ROLE) {
    _WETH = WETH(newWETHAddress);
  }

  function WETHAddress() public view returns (address) {
    return address(_WETH);
  }

  function mapToken(address rootToken, address childToken) override external only(MAPPER_ROLE) {
    _rootToChildToken[rootToken] = childToken;
    _childToRootToken[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  function rootToChildToken(address rootToken) public view returns (address) {
    return _rootToChildToken[rootToken];
  }

  function childToRootToken(address childToken) public view returns (address) {
    return _childToRootToken[childToken];
  }

  function exitedTxs(bytes32 txHash) public view returns (bool) {
    return _exitedTxs[txHash];
  }

  receive() external payable {
    depositEther();
  }

  function depositEther() override public payable {
    require(
      address(_WETH) != address(0x0),
      "WETH not set"
    );
    _WETH.depositFor.value(msg.value)(_msgSender());
    _depositFor(_msgSender(), address(_WETH), msg.value);
  }

  function depositEtherFor(address user) override external payable {
    require(
      address(_WETH) != address(0x0),
      "WETH not set"
    );
    _WETH.depositFor.value(msg.value)(user);
    _depositFor(user, address(_WETH), msg.value);
  }

  function deposit(address rootToken, uint256 amount) override external {
    _depositFor(msg.sender, rootToken, amount);
  }

  function depositFor(address user, address rootToken, uint256 amount) override external {
    _depositFor(user, rootToken, amount);
  }

  function _depositFor(address user, address rootToken, uint256 amount) private {
    require(
      _rootToChildToken[rootToken] != address(0x0),
      "Token not mapped"
    );
    require(
      IERC20(rootToken).allowance(msg.sender, address(this)) >= amount,
      "Token transfer not approved"
    );
    require(
      address(_stateSender) != address(0x0),
      "stateSender not set"
    );
    require(
      address(_childChainManagerAddress) != address(0x0),
      "childChainManager not set"
    );

    IERC20(rootToken).transferFrom(msg.sender, address(this), amount);
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
   *  10- hash of the reference transaction
   */
  function exit(bytes calldata inputData) override external {
    RLPReader.RLPItem[] memory inputDataRLPList = inputData.toRlpItem().toList();

    require(
      _exitedTxs[bytes32(inputDataRLPList[10].toUint())] == false,
      "Exit already processed"
    );
    _exitedTxs[bytes32(inputDataRLPList[10].toUint())] = true;

    uint256 logIndex = inputDataRLPList[9].toUint();
    bytes memory receipt = inputDataRLPList[6].toBytes();
    RLPReader.RLPItem[] memory receiptRLPList = receipt.toRlpItem().toList();
    RLPReader.RLPItem[] memory logRLPList = receiptRLPList[3].toList()[logIndex].toList();

    address childToken = RLPReader.toAddress(logRLPList[0]); // log address field
    require(
      _childToRootToken[childToken] != address(0),
      "Token not mapped"
    );

    RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
    require(
      bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is event sig
      "Not a transfer event signature"
    );
    require(
      msg.sender == address(logTopicRLPList[1].toUint()), // from1 is from address
      "Withdrawer and burn exit tx do not match"
    );
    require(
      address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
      "Not a burn event"
    );

    // TODO: verify tx inclusion
    // required?

    require(
      inputDataRLPList[8].toBytes().toRlpItem().toUint() &
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 ==
        0,
      "Branch mask should be 32 bits"
    );

    uint256 headerNumber = inputDataRLPList[0].toUint();
    require(
      MerklePatriciaProof.verify(
        inputDataRLPList[6].toBytes(), // receipt
        inputDataRLPList[8].toBytes(), // branchMask
        inputDataRLPList[7].toBytes(), // receiptProof
        bytes32(inputDataRLPList[5].toUint()) // receiptsRoot
      ),
      "Invalid receipt merkle proof"
    );

    uint256 blockNumber = inputDataRLPList[2].toUint();
    checkBlockMembershipInCheckpoint(
      blockNumber,
      inputDataRLPList[3].toUint(), // blockTime
      bytes32(inputDataRLPList[4].toUint()), // txRoot
      bytes32(inputDataRLPList[5].toUint()), // receiptRoot
      headerNumber,
      inputDataRLPList[1].toBytes() // blockProof
    );

    IERC20(
      _childToRootToken[childToken]
    ).transfer(msg.sender, logRLPList[2].toUint());

    if (_childToRootToken[childToken] == address(_WETH)) {
      _WETH.withdrawFor(logRLPList[2].toUint(), _msgSender());
    }

    emit Exited(msg.sender, _childToRootToken[childToken], logRLPList[2].toUint());
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
      "Burn tx not part of submitted header"
    );
    return createdAt;
  }
}
