pragma solidity 0.6.6;

import {ERC20} from "./ERC20.sol";
import {AccessControlMixin} from "../../../common/AccessControlMixin.sol";
import {IChildToken} from "../IChildToken.sol";
import {NativeMetaTransactionLegacy as NativeMetaTransaction} from "../../../common/legacy/NativeMetaTransactionLegacy.sol";
import {ChainConstants} from "../../../common/legacy/ChainConstants.sol";
import {ContextMixin} from "../../../common/ContextMixin.sol";

/**
 * @notice FROZEN. The child-ERC20 implementation from before changeName() was added, still the
 * runtime behind six of the largest mapped tokens on Polygon and behind almost every mapped ERC20
 * on Amoy.
 * @dev The contract text below is the verified source of the deployed implementations verbatim,
 * with two edits that touch metadata only and never the runtime: the flattened preamble is
 * replaced by imports of the identical modules this repo already holds, and the contract is
 * suffixed `Superseded` so it does not collide with the current build by name. That the bytecode
 * still reproduces is the proof those modules are byte-identical to what was inlined.
 *
 * UChildERC20.sol is the SAME contract plus changeName(); one source cannot produce both builds,
 * which is why this copy exists rather than a conditional. Each mapped token deploys its own
 * instance of the implementation at its own address, so this one source covers all of them —
 * see the entries pointing here in scripts/pinning/pinned-contracts.json.
 *
 * Build at solc 0.6.6, optimizer OFF, runs 200, istanbul. Compiled and compared, never deployed.
 * Do not edit.
 */
contract UChildERC20Superseded is
    ERC20,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ChainConstants,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor() public ERC20("", "") {}

    /**
     * @notice Initialize the contract after it has been proxified
     * @dev meant to be called once immediately after deployment
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        address childChainManager
    )
        external
        initializer
    {
      setName(name_);
      setSymbol(symbol_);
      setDecimals(decimals_);
      _setupContractId(string(abi.encodePacked("Child", symbol_)));
      _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
      _setupRole(DEPOSITOR_ROLE, childChainManager);
      _initializeEIP712(name_, ERC712_VERSION);
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
}
