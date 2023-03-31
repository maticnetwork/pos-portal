pragma solidity 0.6.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IMintableERC20} from "../RootToken/IMintableERC20.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract MintableERC20Predicate is
    ITokenPredicate,
    AccessControlMixin,
    Initializable
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("MintableERC20");
    bytes32 public constant TRANSFER_EVENT_SIG = keccak256(
        "Transfer(address,address,uint256)"
    );

    event LockedMintableERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    event ExitedMintableERC20(
        address indexed exitor,
        address indexed rootToken,
        uint256 amount
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("MintableERC20Predicate");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

    /**
     * @notice Lock ERC20 tokens for deposit, callable only by manager
     * @param depositor Address who wants to deposit tokens
     * @param depositReceiver Address (address) who wants to receive tokens on child chain
     * @param rootToken Token which gets deposited
     * @param depositData ABI encoded amount
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override only(MANAGER_ROLE) {

        uint256 amount = abi.decode(depositData, (uint256));
        emit LockedMintableERC20(depositor, depositReceiver, rootToken, amount);

        // Attempt to perform safe transfer from i.e. check function return value
        // using low-level call & revert if didn't succeed
        IERC20(rootToken).safeTransferFrom(depositor, address(this), amount);
    }

    /**
     * @notice Validates log signature, from and to address
     * then sends the correct amount to withdrawer
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ERC20 burn log from child chain
     */
    function exitTokens(
        address rootToken,
        bytes calldata log
    ) external override only(MANAGER_ROLE) {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics

        require(
            bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is `Transfer` event sig
            "MintableERC20Predicate: INVALID_SIGNATURE"
        );

        address withdrawer = address(logTopicRLPList[1].toUint()); // topic1 is `from` address

        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is `to` address
            "MintableERC20Predicate: INVALID_RECEIVER"
        );

        IMintableERC20 token = IMintableERC20(rootToken);
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 amount = logRLPList[2].toUint();

        // Checking whether MintableERC20Predicate has enough balance
        // to transfer `amount` to withdrawer or not
        //
        // If no, it'll mint those extra tokens & transfer `amount`
        // to withdrawer
        if (tokenBalance < amount) {
            token.mint(address(this), amount - tokenBalance);
        }

        // Attempt to perform safe transfer i.e. check function return value
        // using low-level call & revert if didn't succeed
        IERC20(rootToken).safeTransfer(withdrawer, amount);

        emit ExitedMintableERC20(withdrawer, rootToken, amount);
    }
}
