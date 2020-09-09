pragma solidity 0.6.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {IChildToken} from "./IChildToken.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract ChildERC721 is
    ERC721,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        address childChainManager
    ) public ERC721(name_, symbol_) {
        _setupContractId("ChildERC721");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, childChainManager);
        _initializeEIP712(name_);
    }

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
     * Should handle deposit by minting the required tokenId for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded tokenId
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        uint256 tokenId = abi.decode(depositData, (uint256));
        _mint(user, tokenId);
    }

    /**
     * @notice called when user wants to withdraw token back to root chain
     * @dev Should burn user's token. This transaction will be verified when exiting on root chain
     * @param tokenId tokenId to withdraw
     */
    function withdraw(uint256 tokenId) external {
        require(_msgSender() == ownerOf(tokenId), "ChildERC721: INVALID_TOKEN_OWNER");
        _burn(tokenId);
    }
}
