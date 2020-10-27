pragma solidity 0.6.6;

import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract EtherPredicate is ITokenPredicate, AccessControlMixin, Initializable {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("Ether");
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    event LockedEther(
        address indexed depositor,
        address indexed depositReceiver,
        uint256 amount
    );

    event ExitedEther(
        address indexed exitor,
        uint256 amount
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("EtherPredicate");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

    /**
     * @notice Receive Ether to lock for deposit, callable only by manager
     */
    receive() external payable only(MANAGER_ROLE) {}

    /**
     * @notice handle ether lock, callable only by manager
     * @param depositor Address who wants to deposit tokens
     * @param depositReceiver Address (address) who wants to receive tokens on child chain
     * @param depositData ABI encoded amount
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address,
        bytes calldata depositData
    )
        external
        override
        only(MANAGER_ROLE)
    {
        uint256 amount = abi.decode(depositData, (uint256));
        emit LockedEther(depositor, depositReceiver, amount);
    }

    /**
     * @notice Validates log signature, from and to address
     * then sends the correct amount to withdrawer
     * callable only by manager
     * @param log Valid ERC20 burn log from child chain
     */
    function exitTokens(
        address,
        address,
        bytes memory log
    )
        public
        override
        only(MANAGER_ROLE)
    {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics

        require(
            bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG, // topic0 is event sig
            "EtherPredicate: INVALID_SIGNATURE"
        );

        address withdrawer = address(logTopicRLPList[1].toUint()); // topic1 is from address

        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "EtherPredicate: INVALID_RECEIVER"
        );

        emit ExitedEther(withdrawer, logRLPList[2].toUint());

        payable(withdrawer).transfer(logRLPList[2].toUint());
    }
}
