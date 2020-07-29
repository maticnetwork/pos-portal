pragma solidity ^0.6.6;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {IMetaDataERC721} from "../RootToken/IMetaDataERC721.sol";

contract MetaDataERC721Predicate is ITokenPredicate, AccessControlMixin, Initializable, IERC721Receiver {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("MetaDataERC721");
    bytes32 public constant TRANSFER_EVENT_SIG = 0x233d4033f24c20bfd0dde8773bff5e9af01bd21ef37ccfd81c77cc5b20747d5b;

    event LockedMetaDataERC721(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 tokenId
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("MetaDataERC721Predicate");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

    /**
     * @notice accepts safe ERC721 transfer
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    )
        external
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @notice Lock ERC721 tokens for deposit, fetches metadata from token contract,
     * callable only by manager
     * @dev Fetches bytes metadata from token contract using tokenId
     * this metadata is included in the depositData so that it is passed to child token
     * @param depositor Address who wants to deposit token
     * @param depositReceiver Address (address) who wants to receive token on child chain
     * @param rootToken Token which gets deposited
     * @param depositData ABI encoded tokenId
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    )
        external
        override
        only(MANAGER_ROLE)
        returns(address, address, bytes memory)
    {
        uint256 tokenId = abi.decode(depositData, (uint256));

        bytes memory metadata = IMetaDataERC721(rootToken).getMetaData(tokenId);
        bytes memory newDepositData = abi.encode(tokenId, metadata);

        IERC721(rootToken).safeTransferFrom(depositor, address(this), tokenId);

        emit LockedMetaDataERC721(depositor, depositReceiver, rootToken, tokenId);
        return (depositReceiver, rootToken, newDepositData);
    }

    /**
     * @notice Validates log signature and from address
     * sends the correct tokenId to withdrawer
     * updates metadata for this tokenId by reading it from log
     * callable only by manager
     * @param withdrawer Address who wants to withdraw token
     * @param rootToken Token which gets withdrawn
     * @param log Valid ERC721 burn log from child chain
     */
    function exitTokens(
        address withdrawer,
        address rootToken,
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
            "MetaDataERC721Predicate: INVALID_SIGNATURE"
        );
        require(
            withdrawer == address(logTopicRLPList[1].toUint()), // topic1 is from address
            "MetaDataERC721Predicate: INVALID_SENDER"
        );

        IERC721(rootToken).safeTransferFrom(
            address(this),
            withdrawer,
            logTopicRLPList[3].toUint() // topic2 is tokenId field
        );

        bytes memory metadata = abi.decode(
            logRLPList[2].toBytes(), // log data field is bytes metadata
            (bytes)
        );
        IMetaDataERC721(rootToken).setMetaData(
            logTopicRLPList[3].toUint(), // topic2 is tokenId field
            metadata
        );
    }
}
