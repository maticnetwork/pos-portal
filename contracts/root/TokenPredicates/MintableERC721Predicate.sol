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
    // keccak256("Transfer(address,address,uint256)")
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
    // keccak256("WithdrawnBatch(address,uint256[])")
    bytes32 public constant WITHDRAW_BATCH_EVENT_SIG = 0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df;
    // keccak256("TransferWithMetadata(address,address,uint256,bytes)")
    bytes32 public constant TRANSFER_WITH_METADATA_EVENT_SIG = 0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14;

    // limit batching of tokens due to gas limit restrictions
    uint256 public constant BATCH_LIMIT = 20;

    event LockedMintableERC721(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 tokenId
    );

    event LockedMintableERC721Batch(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] tokenIds
    );

    event ExitedMintableERC721(
        address indexed exitor,
        address indexed rootToken,
        uint256 tokenId
    );

    event ExitedMintableERC721Batch(
        address indexed exitor,
        address indexed rootToken,
        uint256[] tokenIds
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
     * @notice Lock ERC721 token(s) for deposit, callable only by manager
     * @param depositor Address who wants to deposit token
     * @param depositReceiver Address (address) who wants to receive token on child chain
     * @param rootToken Token which gets deposited
     * @param depositData ABI encoded tokenId(s). It's possible to deposit batch of tokens.
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

        // Locking single ERC721 token
        if (depositData.length == 32) {

            uint256 tokenId = abi.decode(depositData, (uint256));

            // Emitting event that single token is getting locked in predicate
            emit LockedMintableERC721(depositor, depositReceiver, rootToken, tokenId);

            // Transferring token to this address, which will be
            // released when attempted to be unlocked
            IMintableERC721(rootToken).safeTransferFrom(depositor, address(this), tokenId);

        } else {
            // Locking a set a ERC721 token(s)

            uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));

            // Emitting event that a set of ERC721 tokens are getting lockec
            // in this predicate contract
            emit LockedMintableERC721Batch(depositor, depositReceiver, rootToken, tokenIds);

            // These many tokens are attempted to be deposited
            // by user
            uint256 length = tokenIds.length;
            require(length <= BATCH_LIMIT, "MintableERC721Predicate: EXCEEDS_BATCH_LIMIT");

            // Iteratively trying to transfer ERC721 token
            // to this predicate address
            for (uint256 i; i < length; i++) {

                IMintableERC721(rootToken).safeTransferFrom(depositor, address(this), tokenIds[i]);

            }

        }

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
        address rootToken,
        bytes calldata log
    )
        external
        override
        only(MANAGER_ROLE)
    {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics

        // If it's a simple exit ( with out metadata coming from L2 to L1 )
        if(bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG) {

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

            emit ExitedMintableERC721(withdrawer, rootToken, tokenId);

        } else if (bytes32(logTopicRLPList[0].toUint()) == WITHDRAW_BATCH_EVENT_SIG) { // topic0 is event sig
            // If it's a simple batch exit, where a set of
            // ERC721s were burnt in child chain with event signature
            // looking like `WithdrawnBatch(address indexed user, uint256[] tokenIds);`
            //
            // @note This doesn't allow transfer of metadata cross chain
            // For that check below `else if` block

            address withdrawer = address(logTopicRLPList[1].toUint()); // topic1 is from address

            // RLP encoded tokenId list
            bytes memory logData = logRLPList[2].toBytes();

            (uint256[] memory tokenIds) = abi.decode(logData, (uint256[]));
            uint256 length = tokenIds.length;

            IMintableERC721 token = IMintableERC721(rootToken);

            for (uint256 i; i < length; i++) {

                uint256 tokenId = tokenIds[i];

                // Check if token exists or not
                //
                // If does, transfer token to withdrawer
                if (token.exists(tokenId)) {
                    token.safeTransferFrom(
                        address(this),
                        withdrawer,
                        tokenId
                    );
                } else {
                    // If token was minted on L2
                    // we'll mint it here, on L1, during
                    // exiting from L2
                    token.mint(withdrawer, tokenId);
                }

            }

            emit ExitedMintableERC721Batch(withdrawer, rootToken, tokenIds);

        } else if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_WITH_METADATA_EVENT_SIG) {
            // If this is NFT exit with metadata i.e. URI 👆
            //
            // Note: If your token is only minted in L2, you can exit
            // it with metadata. But if it was minted on L1, it'll be
            // simply transferred to withdrawer address. And in that case,
            // it's lot better to exit with `Transfer(address,address,uint256)`
            // i.e. calling `withdraw` method on L2 contract
            // event signature proof, which is defined under first `if` clause
            //
            // If you've called `withdrawWithMetadata`, you should submit
            // proof of event signature `TransferWithMetadata(address,address,uint256,bytes)`

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
                // Minting with metadata received from L2 i.e. emitted
                // by event `TransferWithMetadata` during burning
                bytes memory logData = logRLPList[2].toBytes();
                bytes memory metaData = abi.decode(logData, (bytes));

                token.mint(withdrawer, tokenId, metaData);
            }

            emit ExitedMintableERC721(withdrawer, rootToken, tokenId);

        } else {
            // Attempting to exit with some event signature from L2, which is
            // not ( yet ) supported by L1 exit manager
            revert("MintableERC721Predicate: INVALID_SIGNATURE");
        }

    }
}
