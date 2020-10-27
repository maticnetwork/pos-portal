pragma solidity 0.6.6;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {IMintableERC721} from "../RootToken/IMintableERC721.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract MintableERC721Predicate is ITokenPredicate, AccessControlMixin, Initializable, IERC721Receiver {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    // keccak256("MANAGER_ROLE")
    bytes32 public constant MANAGER_ROLE = 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08;
    // keccak256("MintableERC721")
    bytes32 public constant TOKEN_TYPE = 0xd4392723c111fcb98b073fe55873efb447bcd23cd3e49ec9ea2581930cd01ddc;
    // keccak("Transfer(address,address,uint256)")
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    event LockedMintableERC721(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 tokenId
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("MintableERC721Predicate");
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
     * @notice Lock ERC721 tokens for deposit, callable only by manager
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
    {
        uint256 tokenId = abi.decode(depositData, (uint256));
        emit LockedMintableERC721(depositor, depositReceiver, rootToken, tokenId);
        IMintableERC721(rootToken).safeTransferFrom(depositor, address(this), tokenId);
    }

    /**
     * @notice Validates log signature, from and to address
     * then checks if token already exists on root chain
     * if token exits then transfers it to withdrawer
     * if token doesn't exit then it is minted
     * callable only by manager
     * @param rootToken Token which gets withdrawn
     * @param log Valid ERC721 burn log from child chain
     */
    function exitTokens(
        address,
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
            "MintableERC721Predicate: INVALID_SIGNATURE"
        );

        address withdrawer = address(logTopicRLPList[1].toUint()); // topic1 is from address

        require(
            address(logTopicRLPList[2].toUint()) == address(0), // topic2 is to address
            "MintableERC721Predicate: INVALID_RECEIVER"
        );

        IMintableERC721 token = IMintableERC721(rootToken);
        uint256 tokenId = logTopicRLPList[3].toUint(); // topic3 is tokenId field
        if (token.exists(tokenId)) {
          token.safeTransferFrom(
              address(this),
              withdrawer,
              tokenId
          );
        } else {
          token.mint(withdrawer, tokenId);
        }
    }
}
