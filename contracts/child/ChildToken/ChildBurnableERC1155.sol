pragma solidity 0.6.6;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {IChildToken} from "./IChildToken.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract ChildBurnableERC1155 is
    ERC1155,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    event TransferSingleWithMetadata(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value, bytes data);
    event TransferBatchWithMetadata(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values, bytes data);

    event BurnSingle(address indexed operator, address indexed from, uint256 id, uint256 value);
    event BurnBatch(address indexed operator, address indexed from, uint256[] ids, uint256[] values);

    event BurnSingleWithMetadata(address indexed operator, address indexed from, uint256 id, uint256 value, bytes data);
    event BurnBatchWithMetadata(address indexed operator, address indexed from, uint256[] ids, uint256[] values, bytes data);


    constructor(string memory uri_, address childChainManager)
        public
        ERC1155(uri_)
    {
        _setupContractId("ChildBurnableERC1155");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, childChainManager);
        _initializeEIP712(uri_);
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
     * @notice called when tokens are deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required tokens for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded ids array and amounts array
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        (
            uint256[] memory ids,
            uint256[] memory amounts,
            bytes memory data
        ) = abi.decode(depositData, (uint256[], uint256[], bytes));
        require(user != address(0x0), "ChildBurnableERC1155: INVALID_DEPOSIT_USER");
        _mintBatch(user, ids, amounts, data);
    }

    /**
     * @notice called when user wants to withdraw single token back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param id id to withdraw
     * @param amount amount to withdraw
     */
    function withdrawSingle(uint256 id, uint256 amount) external {
        _burn(_msgSender(), id, amount);
    }

    /**
     * @notice called when user wants to batch withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param ids ids to withdraw
     * @param amounts amounts to withdraw
     */
    function withdrawBatch(uint256[] calldata ids, uint256[] calldata amounts)
        external
    {
        _burnBatch(_msgSender(), ids, amounts);
    }

    function burnSingle(address user, uint256 id, uint256 amount) external only(DEFAULT_ADMIN_ROLE) {

        _burn(user, id, amount);
        emit BurnSingle(_msgSender(), user, id, amount);

    }

    function burnBatch(address user, uint256[] calldata ids, uint256[] calldata amounts) external only(DEFAULT_ADMIN_ROLE) {

        _burnBatch(user, ids, amounts);
        emit BurnBatch(_msgSender(), user, ids, amounts);

    }

    function burnSingleWithMetadata(address user, uint256 id, uint256 amount) external only(DEFAULT_ADMIN_ROLE) {

        emit BurnSingleWithMetadata(_msgSender(), user, id, amount, encodeMetadata(user, id, amount));
        
        _burn(user, id, amount);

    }

    function burnBatchWithMetadata(address user, uint256[] calldata ids, uint256[] calldata amounts) external only(DEFAULT_ADMIN_ROLE) {

        emit BurnBatchWithMetadata(_msgSender(), user, ids, amounts, encodeMetadata(user, ids, amounts));

        _burnBatch(user, ids, amounts);

    }

    function encodeMetadata(address user, uint256 id, uint256 amount) internal pure virtual returns(bytes memory) {

        // Feel free to override this method, for implementing some meaningful
        // encoding method
        return abi.encode(user, id, amount);

    }

    function encodeMetadata(address user, uint256[] memory ids, uint256[] memory amounts) internal pure virtual returns(bytes memory) {

        // Feel free to override this method, for implementing some meaningful
        // encoding method
        return abi.encode(user, ids, amounts);

    }

}
