pragma solidity 0.6.6;

import {IMintableERC1155} from "../RootToken/IMintableERC1155.sol";
import {
    ERC1155Receiver
} from "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract MintableERC1155Predicate is
    ITokenPredicate,
    ERC1155Receiver,
    AccessControlMixin,
    Initializable
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("MintableERC1155");

    bytes32 public constant TRANSFER_SINGLE_EVENT_SIG = keccak256(
        "TransferSingle(address,address,address,uint256,uint256)"
    );
    bytes32 public constant TRANSFER_BATCH_EVENT_SIG = keccak256(
        "TransferBatch(address,address,address,uint256[],uint256[])"
    );

    event LockedBatchMintableERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    event ExitedMintableERC1155(
        address indexed exitor,
        address indexed rootToken,
        uint256 id,
        uint256 amount
    );


    event ExitedBatchMintableERC1155(
        address indexed exitor,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("MintableERC1155Predicate");
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

        emit LockedBatchMintableERC1155(
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

    // Used when attempting to exit with single token, single amount/ id is converted into
    // slice of amounts/ ids
    // Generally size is going to be `1` i.e. single element array, but it's kept generic
    function makeArrayWithValue(uint256 val, uint size) internal pure returns(uint256[] memory) {
        require(
            size > 0,
            "MintableERC1155Predicate: Invalid resulting array length"
        );

        uint256[] memory vals = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            vals[i] = val;
        }

        return vals;
    }

    /**
     * @notice Creates an array of `size` by repeating provided address,
     * to be required for passing to batch balance checking function of ERC1155 tokens.
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
            "MintableERC1155Predicate: Invalid address"
        );
        require(
            size > 0,
            "MintableERC1155Predicate: Invalid resulting array length"
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
     * @param tokenBalances Token balances this contract holds for some ordered token ids
     * @param amountsToBeExited Amount of tokens being exited
     */
    function calculateAmountsToBeMinted(
        uint256[] memory tokenBalances,
        uint256[] memory amountsToBeExited
    ) internal pure returns (uint256[] memory, uint256[] memory, bool) {
        require(
            tokenBalances.length == amountsToBeExited.length,
            "MintableERC1155Predicate: Array length mismatch found"
        );

        // all cells zero initialized
        uint256[] memory toBeMintedAmounts = new uint256[](
            tokenBalances.length
        );
        // all cells zero initialized
        uint256[] memory toBeTransferredAmounts = new uint256[](
            tokenBalances.length
        );
        bool needMintStep;

        // Iteratively calculating amounts of token to be minted/ transferred
        //
        // Please note, in some cases it can be 0, but that will not
        // be a problem, due to implementation of mint/ transfer logic for ERC1155
        for (uint256 i = 0; i < tokenBalances.length; i++) {
            if (tokenBalances[i] < amountsToBeExited[i]) {
                toBeMintedAmounts[i] = amountsToBeExited[i] - tokenBalances[i];
                toBeTransferredAmounts[i] = tokenBalances[i];
                needMintStep = true;
            } else {
                toBeTransferredAmounts[i] = amountsToBeExited[i];
            }
        }

        return (toBeMintedAmounts, toBeTransferredAmounts, needMintStep);
    }

    /**
     * @notice Validates log signature, from and to address
     * then sends the correct tokenId, amount to withdrawer
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ERC1155 TransferSingle burn or TransferBatch burn log from child chain
     */
    function exitTokens(
        address rootToken,
        bytes calldata log
    ) external override only(MANAGER_ROLE) {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics
        bytes memory logData = logRLPList[2].toBytes();

        address withdrawer = address(logTopicRLPList[2].toUint()); // topic2 is from address

        require(
            address(logTopicRLPList[3].toUint()) == address(0), // topic3 is to address
            "MintableERC1155Predicate: INVALID_RECEIVER"
        );

        bytes32 eventSig = bytes32(logTopicRLPList[0].toUint());
        if (eventSig == TRANSFER_SINGLE_EVENT_SIG) {
            (uint256 id, uint256 amount) = abi.decode(
                logData,
                (uint256, uint256)
            );

            IMintableERC1155 token = IMintableERC1155(rootToken);

            uint256 balance = token.balanceOf(address(this), id);
            if (balance < amount) {
                token.mint(withdrawer, id, amount - balance, bytes(""));

                token.safeTransferFrom(
                    address(this),
                    withdrawer,
                    id,
                    balance,
                    bytes("")
                );
            } else {
                token.safeTransferFrom(
                    address(this),
                    withdrawer,
                    id,
                    amount,
                    bytes("")
                );
            }

            emit ExitedMintableERC1155(withdrawer, rootToken, id, amount);

        } else if (eventSig == TRANSFER_BATCH_EVENT_SIG) {
            (uint256[] memory ids, uint256[] memory amounts) = abi.decode(
                logData,
                (uint256[], uint256[])
            );

            IMintableERC1155 token = IMintableERC1155(rootToken);

            uint256[] memory balances = token.balanceOfBatch(makeArrayWithAddress(address(this), ids.length), ids);
            (uint256[] memory toBeMinted, uint256[] memory toBeTransferred, bool needMintStep) = calculateAmountsToBeMinted(balances, amounts);

            if(needMintStep) {
                token.mintBatch(
                    withdrawer,
                    ids,
                    toBeMinted,
                    bytes("")
                );
            }

            token.safeBatchTransferFrom(
                address(this),
                withdrawer,
                ids,
                toBeTransferred,
                bytes("")
            );

            emit ExitedBatchMintableERC1155(withdrawer, rootToken, ids, amounts);
        } else {
            revert("MintableERC1155Predicate: INVALID_WITHDRAW_SIG");
        }
    }
}
