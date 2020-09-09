pragma solidity 0.6.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";

contract DummyERC20 is
    ERC20,
    NativeMetaTransaction,
    ContextMixin
{
    constructor(string memory name_, string memory symbol_)
        public
        ERC20(name_, symbol_)
    {
        uint256 amount = 10**10 * (10**18);
        _mint(_msgSender(), amount);
        _initializeEIP712(name_);
    }

    function mint(uint256 amount) public {
        _mint(_msgSender(), amount);
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
