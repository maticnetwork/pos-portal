// +-----------------------------------------+
// |                                         |
// |     DEPRECATION NOTICE                  |
// |     This contract is deprecated and     |
// |     will not be supported.              |
// |                                         |
// +-----------------------------------------+
pragma solidity 0.6.6;

import {IMintableERC1155} from "../RootToken/IMintableERC1155.sol";
import {
    ERC1155Receiver
} from "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract ChainExitERC1155Predicate is
    ITokenPredicate,
    ERC1155Receiver,
    AccessControlMixin,
    Initializable
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("ChainExitERC1155");
    // Only this event is considered in exit function : ChainExit(address indexed to, uint256[] tokenId, uint256[] amount, bytes data)
    bytes32 public constant CHAIN_EXIT_EVENT_SIG = keccak256("ChainExit(address,uint256[],uint256[],bytes)");

    event LockedBatchChainExitERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("ChainExitERC1155Predicate");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

    /**
     * @notice rejects single transfer
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return 0;
    }

    /**
     * @notice accepts batch transfer
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return ERC1155Receiver(0).onERC1155BatchReceived.selector;
    }

    /**
     * @notice Lock ERC1155 tokens for deposit, callable only by manager
     * @param depositor Address who wants to deposit tokens
     * @param depositReceiver Address (address) who wants to receive tokens on child chain
     * @param rootToken Token which gets deposited
     * @param depositData ABI encoded id array and amount array
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override only(MANAGER_ROLE) {
        // forcing batch deposit since supporting both single and batch deposit introduces too much complexity
        (
            uint256[] memory ids,
            uint256[] memory amounts,
            bytes memory data
        ) = abi.decode(depositData, (uint256[], uint256[], bytes));

        emit LockedBatchChainExitERC1155(
            depositor,
            depositReceiver,
            rootToken,
            ids,
            amounts
        );
        IMintableERC1155(rootToken).safeBatchTransferFrom(
            depositor,
            address(this),
            ids,
            amounts,
            data
        );
    }

    /**
     * @notice Creates an array of `size` by repeating provided address,
     * to be required for passing to batched balance checking function of ERC1155 tokens.
     * @param addr Address to be repeated `size` times in resulting array
     * @param size Size of resulting array
     */
    function makeArrayWithAddress(address addr, uint256 size)
        internal
        pure
        returns (address[] memory)
    {
        require(
            addr != address(0),
            "ChainExitERC1155Predicate: Invalid address"
        );
        require(
            size > 0,
            "ChainExitERC1155Predicate: Invalid resulting array length"
        );

        address[] memory addresses = new address[](size);

        for (uint256 i = 0; i < size; i++) {
            addresses[i] = addr;
        }

        return addresses;
    }

    /**
     * @notice Calculates amount of tokens to be minted, by subtracting available
     * token balances from amount of tokens to be exited
     * @param balances Token balances this contract holds for some ordered token ids
     * @param exitAmounts Amount of tokens being exited
     */
    function calculateAmountsToBeMinted(
        uint256[] memory balances,
        uint256[] memory exitAmounts
    ) internal pure returns (uint256[] memory, bool, bool) {
        uint256 count = balances.length;
        require(
            count == exitAmounts.length,
            "ChainExitERC1155Predicate: Array length mismatch found"
        );

        uint256[] memory toBeMinted = new uint256[](count);
        bool needMintStep;
        bool needTransferStep;

        for (uint256 i = 0; i < count; i++) {
            if (balances[i] < exitAmounts[i]) {
                toBeMinted[i] = exitAmounts[i] - balances[i];
                needMintStep = true;
            }

            if(balances[i] != 0) {
                needTransferStep = true;
            }
        }

        return (toBeMinted, needMintStep, needTransferStep);
    }

    /**
     * @notice Validates log signature, withdrawer address
     * then sends the correct tokenId, amount to withdrawer
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ChainExit log from child chain
     */
    function exitTokens(
        address rootToken,
        bytes calldata log
    ) external override only(MANAGER_ROLE) {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList();
        bytes memory logData = logRLPList[2].toBytes();

        if (bytes32(logTopicRLPList[0].toUint()) == CHAIN_EXIT_EVENT_SIG) {

            address withdrawer = address(logTopicRLPList[1].toUint());
            require(withdrawer != address(0), "ChainExitERC1155Predicate: INVALID_RECEIVER");

            (uint256[] memory ids, uint256[] memory amounts, bytes memory data) = abi.decode(
                logData,
                (uint256[], uint256[], bytes)
            );

            IMintableERC1155 token = IMintableERC1155(rootToken);

            uint256[] memory balances = token.balanceOfBatch(makeArrayWithAddress(address(this), ids.length), ids);
            (uint256[] memory toBeMinted, bool needMintStep, bool needTransferStep) = calculateAmountsToBeMinted(balances, amounts);

            if(needMintStep) {
                token.mintBatch(
                    withdrawer,
                    ids,
                    toBeMinted,
                    data // passing data when minting to withdrawer
                );
            }

            if(needTransferStep) {
                token.safeBatchTransferFrom(
                    address(this),
                    withdrawer,
                    ids,
                    balances,
                    data // passing data when transferring unlocked tokens to withdrawer
                );
            }

        } else {
            revert("ChainExitERC1155Predicate: INVALID_WITHDRAW_SIG");
        }
    }
}
