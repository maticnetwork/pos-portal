pragma solidity 0.6.6;

import {IMintableERC1155} from "../RootToken/IMintableERC1155.sol";
import {
    ERC1155Receiver
} from "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract CustomERC1155Predicate is
    ITokenPredicate,
    ERC1155Receiver,
    AccessControlMixin,
    Initializable
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("CustomERC1155");
    // Only this event is considered in exit function : ChainExit(address indexed to, uint256 tokenId, uint256 amount, bytes data)
    bytes32 public constant CHAIN_EXIT_EVENT_SIG = keccak256("ChainExit(address,uint256,uint256,bytes)");

    event LockedBatchCustomERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("CustomERC1155Predicate");
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

        emit LockedBatchCustomERC1155(
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

    function makeArrayWithValue(uint256 val, uint size) internal pure returns(uint256[] memory) {
        require(
            size > 0,
            "CustomERC1155Predicate: Invalid resulting array length"
        );

        uint256[] memory vals = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            vals[i] = val;
        }

        return vals;
    }

    /**
     * @notice Validates log signature, withdrawer address
     * then sends the correct tokenId, amount to withdrawer
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ChainExit log from child chain
     */
    function exitTokens(
        address,
        address rootToken,
        bytes memory log
    ) public override only(MANAGER_ROLE) {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList();
        bytes memory logData = logRLPList[2].toBytes();

        if (bytes32(logTopicRLPList[0].toUint()) == CHAIN_EXIT_EVENT_SIG) {

            address withdrawer = address(logTopicRLPList[1].toUint());
            require(withdrawer != address(0), "CustomERC1155Predicate: INVALID_RECEIVER");

            (uint256 id, uint256 amount, bytes memory data) = abi.decode(
                logData,
                (uint256, uint256, bytes)
            );

            IMintableERC1155 token = IMintableERC1155(rootToken);
            uint256 tokenBalance = token.balanceOf(address(this), id);

            if (tokenBalance < amount) {
                token.mintBatch(
                    address(this), 
                    makeArrayWithValue(id, 1), 
                    makeArrayWithValue(amount - tokenBalance, 1), 
                    bytes(""));
            }

            token.safeTransferFrom(
                address(this),
                withdrawer,
                id,
                amount,
                data // passing data when transferring all tokens to withdrawer
            );

        } else {
            revert("CustomERC1155Predicate: INVALID_WITHDRAW_SIG");
        }
    }
}
