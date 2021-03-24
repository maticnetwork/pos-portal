pragma solidity 0.6.6;

import {BaseERC20} from "./BaseERC20.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {IChildToken} from "./IChildToken.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";


contract ChildBurnableERC20 is
    BaseERC20,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address childChainManager
    ) public ERC20(name_, symbol_) {
        _setupContractId("ChildBurnableERC20");
        _setupDecimals(decimals_);
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
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        uint256 amount = abi.decode(depositData, (uint256));
        _mint(user, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external {
        _burn(_msgSender(), amount);
    }

    /**
     * @notice called when user wants to **actually** burn tokens on both L2, L1
     * @dev Should burn user's tokens on L2 first, then when L1's predicate contract will burn it
     * too, when asked to, with adequate proof
     *
     * This method will emit event `Burn(address indexed from, uint256 amount)`, to be
     * used in L1 contract when actually tokens need to be burnt on L2, L1
     *
     * May be you don't want any one be able to do this **actual** burning. Feel free to
     * adapt as per your requirement.
     *
     * @param amount amount of tokens to burn on both L2, L1
     */
    function burn(uint256 amount) external only(DEFAULT_ADMIN_ROLE) {
        _customBurn(_msgSender(), amount);
    }
}
