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

    constructor() public {
        // Disable initializer on implementation contract
        _disableInitializer();
    }

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
     * @notice address unused, being kept for abi compatability
     * @notice address unused, being kept for abi compatability
     * @param log Valid ERC20 burn log from child chain
     */
    function exitTokens(
        address,
        address,
        bytes calldata log
    )
        external
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

        (bool success, /* bytes memory data */) = withdrawer.call{value: logRLPList[2].toUint()}("");
        if (!success) {
            revert("EtherPredicate: ETHER_TRANSFER_FAILED");
        }
    }

    /**
     * @notice Migrate tokens to a specified target address.
     * @dev This function utilizes the "call" method internally to support various token standards.
     * @dev The address of the ERC token being migrated (not used for Ether).
     * @param data ABI encoded data containing details such as the target address and amount.
     * The `data` parameter must be ABI encoded as (address receiver, uint256 amount).
     */
    function migrateTokens(address, bytes calldata data)
        external
        override
        only(MANAGER_ROLE)
    {
        (address receiver, uint256 amount) = abi.decode(data, (address, uint256));
        (bool ok, bytes memory ret) = receiver.call{value: amount}("");
        assembly {
            if iszero(ok) { revert(add(32, ret), ret) }
        }
    }
}
