// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {ChildERC20} from "contracts/child/ChildToken/ChildERC20.sol";

contract ChildERC20Test is Test, NMTHelpers {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    ChildERC20 internal childERC20;

    Account internal signer;
    address internal childChainManagerAddr;

    bytes internal revertMsg = "ChildERC20: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");

        childERC20 = new ChildERC20(
            "Name",
            "Symbol",
            18,
            childChainManagerAddr
        );

        signer = makeAccount("signer");
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            childERC20.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childERC20.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        childERC20 = new ChildERC20(
            "Name",
            "Symbol",
            18,
            childChainManagerAddr
        );

        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("Name")),
                keccak256(bytes(childERC20.ERC712_VERSION())),
                address(childERC20),
                bytes32(childERC20.getChainId())
            )
        );

        assertEq(childERC20.name(), "Name");
        assertEq(childERC20.symbol(), "Symbol");
        assertEq(uint256(childERC20.decimals()), 18);
        assertEq(childERC20.getDomainSeperator(), expectedDomainSeperator);
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childERC20.deposit(address(0), "");
    }

    function testDeposit() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1337e18;
        uint256 totalSupply = childERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit Transfer(address(0), recipient, amount);

        childERC20.deposit(recipient, abi.encode(amount));

        assertEq(childERC20.balanceOf(recipient), amount);
        assertEq(childERC20.totalSupply(), totalSupply + amount);
    }

    function testWithdraw() public {
        Account memory burner = makeAccount("burner");
        uint256 startingAmount = 1337e18;
        uint256 amountToWithdraw = 1e18;
        uint256 totalSupply = childERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        childERC20.deposit(burner.addr, abi.encode(startingAmount));

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit Transfer(burner.addr, address(0), amountToWithdraw);

        executeMetaTransaction(
            address(childERC20),
            abi.encodeWithSelector(
                childERC20.withdraw.selector,
                amountToWithdraw
            ),
            burner
        );

        assertEq(
            childERC20.balanceOf(burner.addr),
            startingAmount - amountToWithdraw
        );
        assertEq(
            childERC20.totalSupply(),
            totalSupply + startingAmount - amountToWithdraw
        );
    }
}
