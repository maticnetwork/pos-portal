pragma solidity ^0.6.6;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract ERC721Predicate is ITokenPredicate, AccessControl, Initializable, IERC721Receiver {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("ERC721");
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    event LockedERC721(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 tokenId
    );

    modifier only(bytes32 role) {
        require(hasRole(role, _msgSender()), "ERC721Predicate: INSUFFICIENT_PERMISSIONS");
        _;
    }

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

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

    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    )
        external
        override
        only(MANAGER_ROLE)
    {
        uint256 tokenId = abi.decode(depositData, (uint256));
        emit LockedERC721(depositor, depositReceiver, rootToken, tokenId);
        IERC721(rootToken).safeTransferFrom(depositor, address(this), tokenId);
    }

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
            "ERC721Predicate: INVALID_SIGNATURE"
        );
        require(
            withdrawer == address(logTopicRLPList[1].toUint()), // topic1 is from address
            "ERC721Predicate: INVALID_SENDER"
        );
        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "ERC721Predicate: INVALID_RECEIVER"
        );

        IERC721(rootToken).safeTransferFrom(
            address(this),
            withdrawer,
            logTopicRLPList[3].toUint() // topic3 is tokenId field
        );
    }
}
