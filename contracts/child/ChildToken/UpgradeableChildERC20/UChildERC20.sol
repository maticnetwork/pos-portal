pragma solidity 0.6.6;

import {ERC20} from "./ERC20.sol";
import {AccessControlMixin} from "../../../common/AccessControlMixin.sol";
import {IChildToken} from "../IChildToken.sol";
import {NativeMetaTransaction} from "../../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../../common/ContextMixin.sol";


contract UChildERC20 is
    ERC20,
    IChildToken,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor() public ERC20("", "") {}

    // This is to support Native meta transactions
    // never use msg.sender directly, use _msgSender() instead
    function _msgSender()
        internal
        override
        virtual
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    function changeName(string calldata name_) external only(DEFAULT_ADMIN_ROLE) {
        setName(name_);
        _setDomainSeperator(name_);
    }

    function changeSymbol(string calldata symbol_) external only(DEFAULT_ADMIN_ROLE) {
        setSymbol(symbol_);
    }

    function deposit(address user, bytes calldata depositData) external override {
        revert("not implemented");
    }

    function withdraw(address user) external {
        revert("not implemented");
    }

    uint256[50] private __gap;
}
