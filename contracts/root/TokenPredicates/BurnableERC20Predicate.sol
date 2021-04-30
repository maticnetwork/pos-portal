pragma solidity 0.6.6;

import {IBurnableERC20} from "../RootToken/IBurnableERC20.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";
import {RLPReader} from "../../lib/RLPReader.sol";
import {ITokenPredicate} from "./ITokenPredicate.sol";
import {Initializable} from "../../common/Initializable.sol";

contract BurnableERC20Predicate is
    ITokenPredicate,
    AccessControlMixin,
    Initializable
{
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant TOKEN_TYPE = keccak256("BurnableERC20");
    // Standard ERC20 transfer event signature : keccak256("Transfer(address,address,uint256)")
    bytes32 public constant TRANSFER_EVENT_SIG = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;
    // When you've burned tokens on L2 & want to do same on L1 : keccak256("Burn(address,uint256)"), signature
    // event needs to be emitted
    bytes32 public constant BURN_EVENT_SIG = 0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5;

    // Offchain L1 clients can keep track of how many tokens getting deposited, by whom etc.
    event LockedBurnableERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    constructor() public {}

    function initialize(address _owner) external initializer {
        _setupContractId("BurnableERC20Predicate");
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MANAGER_ROLE, _owner);
    }

    /**
     * @notice Lock burnable ERC20 tokens for deposit, callable only by manager, when depositing from L1 to L2
     * @param depositor Address who wants to deposit tokens
     * @param depositReceiver Address (address) who wants to receive tokens on child chain
     * @param rootToken Token which gets deposited
     * @param depositData ABI encoded amount
     */
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external override only(MANAGER_ROLE) {
        uint256 amount = abi.decode(depositData, (uint256));

        emit LockedBurnableERC20(depositor, depositReceiver, rootToken, amount);
        IBurnableERC20(rootToken).transferFrom(
            depositor,
            address(this),
            amount
        );
    }

    /**
     * @notice Validates log signature, from and to address
     * then burns whole withdrawn amount
     *
     * @param rootToken L1 token which gets withdrawn
     * @param log Valid ERC20 burn log from child chain
     */
    function exitTokens(
        address,
        address rootToken,
        bytes memory log
    ) public override only(MANAGER_ROLE) {
        RLPReader.RLPItem[] memory logRLPList = log.toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList(); // topics

        // User who's withdrawing
        address withdrawer = address(logTopicRLPList[1].toUint());

        // Checking if user wanted to get fund back on L1, after burning it on L2
        if(bytes32(logTopicRLPList[0].toUint()) == TRANSFER_EVENT_SIG) {
            
            require(address(logTopicRLPList[2].toUint()) == address(0), "BurnableERC20Predicate: INVALID_RECEIVER");

            uint256 amount = logRLPList[2].toUint();
            
            IBurnableERC20 token = IBurnableERC20(rootToken);
            token.transfer(withdrawer, amount);

            return;

        }

        // Checking whether user wanted to **actually** burn tokens
        // on both L2, L1
        if(bytes32(logTopicRLPList[0].toUint()) == BURN_EVENT_SIG) {

            uint256 amount = logRLPList[2].toUint();

            IBurnableERC20 token = IBurnableERC20(rootToken);
            // Make sure L1, token burning function can be ( only ) invoked
            // by this predicate contract
            //
            // @note Because this predicate contracts has those tokens locked with self
            token.burn(address(this), amount);

            return;

        }

        revert("BurnableERC20Predicate: INVALID_SIGNATURE");
    }
}
