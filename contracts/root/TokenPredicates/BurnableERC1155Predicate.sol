pragma solidity 0.6.6;

import {IBurnableERC1155} from "../RootToken/IBurnableERC1155.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";
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
    bytes32 public constant TOKEN_TYPE = keccak256("BurnableERC1155");

    // When exiting ERC1155 normally : keccak256("TransferSingle(address,address,address,uint256,uint256)")
    bytes32 public constant TRANSFER_SINGLE_EVENT_SIG = 0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62;
    // When a batch of ERC1155(s) exiting normally : keccak256("TransferBatch(address,address,address,uint256[],uint256[])")
    bytes32 public constant TRANSFER_BATCH_EVENT_SIG = 0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb;
    // If you're interested in **actually** burning tokens : keccak256("BurnSingle(address,address,uint256,uint256)")
    bytes32 public constant BURN_SINGLE_EVENT_SIG = 0x995c922928fc04a31c6446db7f51f402ddb95ac41fa3dca51c98ff1fe7300531;
    // If you're willing to **actually** burn a batch of tokens : keccak256("BurnBatch(address,address,uint256[],uint256[])")
    bytes32 public constant BURN_BATCH_EVENT_SIG = 0xf6d51a8d20e8b0143ca41399aa93b2a480cb0b95e39847e4ebd3144b2db8775d;

    event LockedBatchBurnableERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("BurnableERC1155Predicate");
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

        emit LockedBatchBurnableERC1155(
            depositor,
            depositReceiver,
            rootToken,
            ids,
            amounts
        );
        IBurnableERC1155(rootToken).safeBatchTransferFrom(
            depositor,
            address(this),
            ids,
            amounts,
            data
        );
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
            "BurnableERC1155Predicate: Invalid address"
        );
        require(
            size > 0,
            "BurnableERC1155Predicate: Invalid resulting array length"
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
    ) internal pure returns (uint256[] memory) {
        require(
            tokenBalances.length == amountsToBeExited.length,
            "BurnableERC1155Predicate: Array length mismatch found"
        );

        uint256[] memory toBeMintedAmounts = new uint256[](
            tokenBalances.length
        );

        // Iteratively calculating amounts of token to be minted
        //
        // Please note, in some cases it can be 0, but that will not
        // be a problem, due to implementation of mint logic for ERC1155
        for (uint256 i = 0; i < tokenBalances.length; i++) {
            if (tokenBalances[i] < amountsToBeExited[i]) {
                toBeMintedAmounts[i] = amountsToBeExited[i] - tokenBalances[i];
            }
        }

        return toBeMintedAmounts;
    }

    /**
     * @notice Validates log signature, from and to address
     * then sends the correct tokenId, amount to withdrawer
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ERC1155 TransferSingle burn or TransferBatch burn log from child chain
     */
    function exitTokens(
        address,
        address rootToken,
        bytes memory log
    ) public override only(MANAGER_ROLE) {

        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList();

        bytes memory logData = logRLPList[2].toBytes();
        address withdrawer = address(logTopicRLPList[2].toUint());

        if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_SINGLE_EVENT_SIG) {

            require(address(logTopicRLPList[3].toUint()) == address(0), "BurnableERC1155Predicate: INVALID_RECEIVER");

            (uint256 id, uint256 amount) = abi.decode(
                logData,
                (uint256, uint256)
            );

            IBurnableERC1155 token = IBurnableERC1155(rootToken);
            token.safeTransferFrom(
                address(this),
                withdrawer,
                id,
                amount,
                bytes("")
            );

            return;

        }
        
        if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_BATCH_EVENT_SIG) {

            require(address(logTopicRLPList[3].toUint()) == address(0), "BurnableERC1155Predicate: INVALID_RECEIVER");
            
            (uint256[] memory ids, uint256[] memory amounts) = abi.decode(
                logData,
                (uint256[], uint256[])
            );

            IBurnableERC1155 token = IBurnableERC1155(rootToken);
            token.safeBatchTransferFrom(
                address(this),
                withdrawer,
                ids,
                amounts,
                bytes("")
            );

            return;

        }

        if (bytes32(logTopicRLPList[0].toUint()) == BURN_SINGLE_EVENT_SIG) {

            (uint256 id, uint256 amount) = abi.decode(
                logData,
                (uint256, uint256)
            );

            IBurnableERC1155 token = IBurnableERC1155(rootToken);
            token.burn(
                address(this),
                id,
                amount,
                bytes("")
            );

            return;

        }

        if (bytes32(logTopicRLPList[0].toUint()) == BURN_BATCH_EVENT_SIG) {
            
            (uint256[] memory ids, uint256[] memory amounts) = abi.decode(
                logData,
                (uint256[], uint256[])
            );

            IBurnableERC1155 token = IBurnableERC1155(rootToken);
            token.burnBatch(
                address(this),
                ids,
                amounts,
                bytes("")
            );

            return;

        }

        revert("BurnableERC1155Predicate: INVALID_WITHDRAW_SIG");

    }
}
