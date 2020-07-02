pragma solidity "0.6.6";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IChildToken} from "./IChildToken.sol";
import {NetworkAgnostic} from "../../common/NetworkAgnostic.sol";
import {ChainConstants} from "../../ChainConstants.sol";


contract ChildERC20 is ERC20, IChildToken, AccessControl, NetworkAgnostic, ChainConstants {
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) public ERC20(name_, symbol_) NetworkAgnostic(name_, ERC712_VERSION, ROOT_CHAIN_ID) {
        _setupDecimals(decimals_);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, _msgSender());
    }

    modifier only(bytes32 role) {
        require(hasRole(role, _msgSender()), "ChildERC20: INSUFFICIENT_PERMISSIONS");
        _;
    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }

    function deposit(address user, bytes calldata depositData)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        uint256 amount = abi.decode(depositData, (uint256));
        require(amount > 0, "ChildERC20: INVALID_AMOUNT");
        require(user != address(0x0), "ChildERC20: INVALID_DEPOSIT_USER");
        _mint(user, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "ChildERC20: INVALID_WITHDRAW_AMOUNT");
        require(
            amount <= balanceOf(_msgSender()),
            "ChildERC20: INSUFFICIENT_BALANCE"
        );

        _burn(_msgSender(), amount);
    }
}
