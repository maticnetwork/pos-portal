pragma solidity 0.6.6;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {IBurnableERC721} from "../RootToken/IBurnableERC721.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract BurnableERC721Predicate is ITokenPredicate, AccessControlMixin, Initializable, IERC721Receiver {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    // keccak256("MANAGER_ROLE")
    bytes32 public constant MANAGER_ROLE = 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08;
    // keccak256("BurnableERC721")
    bytes32 public constant TOKEN_TYPE = 0x9932c41b1814ce69a51d370b7d5d7f077408066c2478ef836bb2999f1241fe17;

    // Standard ERC721 transfer event : keccak256("Transfer(address,address,uint256)")
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
    // Batch withdraw of ERC721s, from L2 : keccak256("WithdrawnBatch(address,uint256[])")
    bytes32 public constant WITHDRAW_BATCH_EVENT_SIG = 0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df;
    // Transfer metadata along with token, from L2 : keccak256("TransferWithMetadata(address,address,uint256,bytes)")
    bytes32 public constant TRANSFER_WITH_METADATA_EVENT_SIG = 0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14;

    // Single token **actually** being burnt : keccak256("Burn(address,uint256)")
    bytes32 public constant BURN_EVENT_SIG = 0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5;
    // Multiple tokens **actually** being burnt : keccak256("BurnBatch(address,uint256[])")
    bytes32 public constant BURN_BATCH_EVENT_SIG = 0xe273d72a96a7fdfbd6fce43480e61823001840b0c7f8e8fb98547d6ff97c76ec;
    // When burning token, also bring arbitrary metadata from L2 : keccak256("BurnWithMetadata(address,uint256,bytes)")
    bytes32 public constant BURN_WITH_METADATA_EVENT_SIG = 0x3ac625ae25324fad5c19dab1be09e9c45faef370122d9d1b826a9cd3994f9da9;

    // limit batching of tokens due to gas limit restrictions
    uint256 public constant BATCH_LIMIT = 20;

    event LockedBurnableERC721(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 tokenId
    );

    event LockedBurnableERC721Batch(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] tokenIds
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("BurnableERC721Predicate");
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
            emit LockedBurnableERC721(depositor, depositReceiver, rootToken, tokenId);

            // Transferring token to this address, which will be
            // released when attempted to be unlocked
            IBurnableERC721(rootToken).safeTransferFrom(depositor, address(this), tokenId);

        } else {
            // Locking a set a ERC721 token(s)

            uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));

            // Emitting event that a set of ERC721 tokens are getting lockec
            // in this predicate contract
            emit LockedBurnableERC721Batch(depositor, depositReceiver, rootToken, tokenIds);

            // These many tokens are attempted to be deposited
            // by user
            uint256 length = tokenIds.length;
            require(length <= BATCH_LIMIT, "MintableERC721Predicate: EXCEEDS_BATCH_LIMIT");

            // Iteratively trying to transfer ERC721 token
            // to this predicate address
            for (uint256 i; i < length; i++) {

                IBurnableERC721(rootToken).safeTransferFrom(depositor, address(this), tokenIds[i]);

            }

        }

    }

    /**
     * @notice Validates log signature, from and to address
     * then attempts to burn token on L1, which is already burnt on L2
     *
     * You're supposed to be using predicate when you want to burn
     * your ERC721 on both L2, L1
     *
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

        // User, who's attempting to withdraw/ burn token(s)
        address withdrawer = address(logTopicRLPList[1].toUint());

        // If it's a simple exit ( with out metadata coming from L2 to L1 )
        if(bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG) {

            require(
                address(logTopicRLPList[2].toUint()) == address(0), // topic2 is `to` address
                "BurnableERC721Predicate: INVALID_RECEIVER"
            );

            IBurnableERC721 token = IBurnableERC721(rootToken);

            uint256 tokenId = logTopicRLPList[3].toUint();
            token.safeTransferFrom(address(this), withdrawer, tokenId);

            return;

        }

        if (bytes32(logTopicRLPList[0].toUint()) == WITHDRAW_BATCH_EVENT_SIG) {
            // If it's a simple batch exit, where a set of
            // ERC721s were burnt in child chain with event signature
            // looking like `WithdrawnBatch(address indexed user, uint256[] tokenIds);`
            //
            // @note This doesn't allow transfer of metadata cross chain
            // For that check below `if` block

            // RLP encoded tokenId list
            bytes memory logData = logRLPList[2].toBytes();

            (uint256[] memory tokenIds) = abi.decode(logData, (uint256[]));
            uint256 length = tokenIds.length;

            IBurnableERC721 token = IBurnableERC721(rootToken);

            for (uint256 i; i < length; i++) {

                uint256 tokenId = tokenIds[i];
                token.safeTransferFrom(address(this), withdrawer, tokenId);

            }

            return;

        }

        if (bytes32(logTopicRLPList[0].toUint()) == TRANSFER_WITH_METADATA_EVENT_SIG) { 
            // This is used when NFT exit is done with arbitrary metadata on L2

            require(
                address(logTopicRLPList[2].toUint()) == address(0), // topic2 is `to` address
                "BurnableERC721Predicate: INVALID_RECEIVER"
            );

            IBurnableERC721 token = IBurnableERC721(rootToken);
            
            uint256 tokenId = logTopicRLPList[3].toUint();

            token.safeTransferFrom(address(this), withdrawer, tokenId);
            // This function will be invoked for passing arbitrary
            // metadata, obtained from event emitted in L2, to
            // L1 ERC721, so that it can decode & do further processing
            //
            // @note Make sure you've implemented this method in your L1 contract
            // if you're interested in exiting with metadata
            token.setTokenMetadata(tokenId, logRLPList[2].toBytes());

            return;

        }

        // When user is attempting to do an **actual** burn
        if(bytes32(logTopicRLPList[0].toUint()) == BURN_EVENT_SIG) {

            uint256 tokenId = logTopicRLPList[2].toUint();

            IBurnableERC721 token = IBurnableERC721(rootToken);
            // Make sure your L1 contract implements this method & this
            // predicate is allowed to burn owned token(s)
            token.burn(address(this), tokenId);

            return;

        }

        // When user is interested in **actually** burning a batch of tokens
        // in L1 too, they're expected to be emitted event on L2, with this signature
         if (bytes32(logTopicRLPList[0].toUint()) == BURN_BATCH_EVENT_SIG) {

            // RLP encoded tokenId list
            bytes memory logData = logRLPList[2].toBytes();

            (uint256[] memory tokenIds) = abi.decode(logData, (uint256[]));
            uint256 length = tokenIds.length;

            IBurnableERC721 token = IBurnableERC721(rootToken);

            for (uint256 i; i < length; i++) {

                uint256 tokenId = tokenIds[i];
                token.burn(address(this), tokenId);

            }

            return;

        }

        // Attempting to exit with some event signature from L2, which is
        // not ( yet ) supported
        revert("BurnableERC721Predicate: INVALID_SIGNATURE");

    }
}
