pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {IChildToken} from "./IChildToken.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";


contract ChildBurnableERC721 is
    ERC721,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    mapping (uint256 => bool) public withdrawnTokens;

    // limit batching of tokens due to gas limit restrictions
    uint256 public constant BATCH_LIMIT = 20;

    // When you're interested in doing a batch withdraw of tokens, without **actually** burning them
    event WithdrawnBatch(address indexed user, uint256[] tokenIds);
    // When you want to transfer token from L2 to L1, while also taking some arbitrary metadata, cross-chain
    // with out **actually** burning it
    event TransferWithMetadata(address indexed from, address indexed to, uint256 indexed tokenId, bytes metaData);

    // When you want to **actually** burn token, on L2, L1
    event Burn(address indexed from, uint256 indexed tokenId);
    // When you want to **actually** burn a batch of tokens, on L2, L1
    event BurnBatch(address indexed from, uint256[] tokenIds);
    // When you're interested in **actually** burning token & also transferring arbitrary data
    // cross chain i.e. L2 -> L1
    event BurnWithMetadata(address indexed from, uint256 indexed tokenId, bytes metaData);

    constructor(
        string memory name_,
        string memory symbol_,
        address childChainManager
    ) public ERC721(name_, symbol_) {
        _setupContractId("ChildBurnableERC721");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, childChainManager);
        _initializeEIP712(name_);
    }

    // This is to support Native meta transactions
    // never use msg.sender directly, use _msgSender() instead
    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required tokenId(s) for user
     * Should set `withdrawnTokens` mapping to `false` for the tokenId being deposited
     * Minting can also be done by other functions
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded tokenIds. Batch deposit also supported.
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
        only(DEPOSITOR_ROLE)
    {

        // deposit single
        if (depositData.length == 32) {
            uint256 tokenId = abi.decode(depositData, (uint256));
            withdrawnTokens[tokenId] = false;
            _mint(user, tokenId);

        // deposit batch
        } else {
            uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));
            uint256 length = tokenIds.length;
            for (uint256 i; i < length; i++) {
                withdrawnTokens[tokenIds[i]] = false;
                _mint(user, tokenIds[i]);
            }
        }

    }

    /**
     * @notice called when user wants to withdraw token back to root chain
     * @dev Should handle withraw by burning user's token.
     * Should set `withdrawnTokens` mapping to `true` for the tokenId being withdrawn
     * This transaction will be verified when exiting on root chain
     * @param tokenId tokenId to withdraw
     */
    function withdraw(uint256 tokenId) external {
        require(_msgSender() == ownerOf(tokenId), "ChildBurnableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;
        _burn(tokenId);
    }

    /**
     * @notice called when user wants to withdraw multiple tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param tokenIds tokenId list to withdraw
     */
    function withdrawBatch(uint256[] calldata tokenIds) external {

        uint256 length = tokenIds.length;
        require(length <= BATCH_LIMIT, "ChildBurnableERC721: EXCEEDS_BATCH_LIMIT");

        // Iteratively burn ERC721 tokens, for performing
        // batch withdraw
        for (uint256 i; i < length; i++) {

            uint256 tokenId = tokenIds[i];

            require(_msgSender() == ownerOf(tokenId), string(abi.encodePacked("ChildBurnableERC721: INVALID_TOKEN_OWNER ", tokenId)));
            withdrawnTokens[tokenId] = true;
            _burn(tokenId);

        }

        // At last emit this event, which will be used
        // in MintableERC721 predicate contract on L1
        // while verifying burn proof
        emit WithdrawnBatch(_msgSender(), tokenIds);

    }

    /**
     * @notice called when user wants to withdraw token back to root chain with token URI
     * @dev Should handle withraw by burning user's token.
     * Should set `withdrawnTokens` mapping to `true` for the tokenId being withdrawn
     * This transaction will be verified when exiting on root chain
     *
     * @param tokenId tokenId to withdraw
     */
    function withdrawWithMetadata(uint256 tokenId) external {

        require(_msgSender() == ownerOf(tokenId), "ChildBurnableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;

        // Encoding metadata associated with tokenId & emitting event
        emit TransferWithMetadata(ownerOf(tokenId), address(0), tokenId, this.encodeTokenMetadata(tokenId));

        _burn(tokenId);

    }

    /**
     * @notice Use this method when you want to **actually** burn token on both L2, L1
     *
     * @dev Invoking this method emits both `Transfer` & `Burn` event, now it can be considered as
     * race between actually burning token on L1 or transferring token on L1
     *
     * Let's take an example, you're owner of this token `T` & wanted to actually burn token
     * you invoked this method & now this burn tx is eligible for both **actual** burn on L1 &
     * transferring to your account on L1
     *
     * Some one ( other than you ) can perform `exit` on L1, for this tx, while packing proof
     * as this tx only emitted `Transfer` event, & you'll receive token on L1, but remember your
     * objective wasn't that.
     *
     * Now question is would someone do it before you perform your own `exit`, where they don't
     * really have any **direct** monetary benefit ?
     *
     * You can consider writing your custom child token, which doesn't suffer from this syndrome.
     *
     */
    function burn(uint256 tokenId) external {

        require(_msgSender() == ownerOf(tokenId), "ChildBurnableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;
        _burn(tokenId);

        // This event will be used in predicate for **actually** burning token
        emit Burn(_msgSender(), tokenId);

    }

    /**
     * @notice Use this method when you want to **actually** burn a batch of tokens, on both L2, L1
     *
     * @dev You're strictly adviced to read <ChildBurnableERC721:burn>, defined above
     */
    function burnBatch(uint256[] calldata tokenIds) external {


        uint256 length = tokenIds.length;
        require(length <= BATCH_LIMIT, "ChildBurnableERC721: EXCEEDS_BATCH_LIMIT");

        // Iteratively burn ERC721 tokens, for performing
        // batch withdraw
        for (uint256 i; i < length; i++) {

            uint256 tokenId = tokenIds[i];

            require(_msgSender() == ownerOf(tokenId), string(abi.encodePacked("ChildBurnableERC721: INVALID_TOKEN_OWNER ", tokenId)));
            withdrawnTokens[tokenId] = true;
            _burn(tokenId);

        }

        // At last emit this event, which will be used
        // in BurnableRC721 predicate contract on L1
        // while verifying burn proof
        emit BurnBatch(_msgSender(), tokenIds);

    }

    /**
     * @notice You're supposed to be invoking this method, when you want to
     * **actually** burn a token on both L2, L1 & bring some arbitary metadata
     * cross-chain
     *
     * @dev You're strictly adviced to read <ChildBurnableERC721:burn>, defined above
     */
    function burnWithMetadata(uint256 tokenId) external {

        require(_msgSender() == ownerOf(tokenId), "ChildBurnableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;

        // Encoding metadata associated with tokenId & emitting event
        emit BurnWithMetadata(_msgSender(), tokenId, this.encodeTokenMetadata(tokenId));

        _burn(tokenId);

    }

    /**
     * @notice This method will be invoked when you're attempting to withdraw with arbitrary metadata
     *
     * It can be overridden by clients to encode data in a different form, which needs to
     * be decoded back by them correctly during exiting
     *
     * @param tokenId Token for which URI to be fetched
     */
    function encodeTokenMetadata(uint256 tokenId) external view virtual returns (bytes memory) {

        // You're always free to change this default implementation
        // and pack more data in byte array which can be decoded back
        // in L1
        return abi.encode(tokenURI(tokenId));

    }

    /**
     * @notice Example function to handle minting tokens on matic chain
     * @dev Minting can be done as per requirement,
     * This implementation allows only admin to mint tokens but it can be changed as per requirement
     * Should verify if token is withdrawn by checking `withdrawnTokens` mapping
     * @param user user for whom tokens are being minted
     * @param tokenId tokenId to mint
     */
    function mint(address user, uint256 tokenId) public only(DEFAULT_ADMIN_ROLE) {
        require(!withdrawnTokens[tokenId], "ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN");
        _mint(user, tokenId);
    }
}
