pragma solidity 0.6.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IBurnableERC20} from "./IBurnableERC20.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";

contract DummyBurnableERC20 is
    ERC20,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin,
    IBurnableERC20
{
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");

    constructor(string memory name_, string memory symbol_)
        public
        ERC20(name_, symbol_)
    {
        _setupContractId("DummyBurnableERC20");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());

        _mint(_msgSender(), 10**10 * (10**18));
        _initializeEIP712(name_);
    }

    /**
     * @dev See {IBurnableERC20-mint}.
     */
    function burn(address user, uint256 amount) external override only(PREDICATE_ROLE) {
        _burn(user, amount);
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }
}
