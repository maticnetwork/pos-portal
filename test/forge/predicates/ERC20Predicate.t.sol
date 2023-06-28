// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";
import {ERC20Predicate} from "contracts/root/TokenPredicates/ERC20Predicate.sol";
import {DummyERC20} from "contracts/root/RootToken/DummyERC20.sol";

contract ERC20PredicateTest is Test {
    ERC20Predicate internal erc20Predicate;
    DummyERC20 internal erc20Token;
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal amt = 1e4 ether;

    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event LockedERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    event ExitedERC20(
        address indexed exitor,
        address indexed rootToken,
        uint256 amount
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        erc20Predicate = new ERC20Predicate();
        erc20Token = new DummyERC20("Test", "TST");
        vm.prank(manager);
        erc20Predicate.initialize(manager);

        vm.startPrank(alice);
        erc20Token.mint(amt);
        erc20Token.approve(address(erc20Predicate), amt);
        vm.stopPrank();
    }

    function testAliceBalanceAndApproval() public {
        assertEq(erc20Token.balanceOf(alice), amt);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), 0);
        assertEq(erc20Token.allowance(alice, address(erc20Predicate)), amt);
        assertEq(erc20Token.allowance(address(erc20Predicate), alice), 0);
    }

    function testInitialize() public {
        vm.expectRevert("already inited");
        erc20Predicate.initialize(manager);

        erc20Predicate = new ERC20Predicate();

        vm.expectEmit();
        emit RoleGranted(
            erc20Predicate.DEFAULT_ADMIN_ROLE(),
            manager,
            address(this)
        );
        vm.expectEmit();
        emit RoleGranted(erc20Predicate.MANAGER_ROLE(), manager, address(this));

        erc20Predicate.initialize(manager);
    }

    function testLockTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("ERC20Predicate: INSUFFICIENT_PERMISSIONS");
        erc20Predicate.lockTokens(
            alice /* depositor */,
            bob /* depositReceiver */,
            address(erc20Token),
            depositData
        );
    }

    function testLockTokens() public {
        bytes memory depositData = abi.encode(amt);

        assertEq(erc20Token.balanceOf(alice), amt);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), 0);
        assertEq(erc20Token.balanceOf(bob), 0);

        vm.expectEmit();
        emit LockedERC20(alice, bob, address(erc20Token), amt);
        vm.expectEmit();
        emit Transfer(alice, address(erc20Predicate), amt);

        vm.prank(manager);
        erc20Predicate.lockTokens(alice, bob, address(erc20Token), depositData);

        assertEq(erc20Token.balanceOf(alice), 0);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), amt);
        assertEq(erc20Token.balanceOf(bob), 0);
    }

    function testLockTokensInsufficientBalance() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        vm.prank(manager);
        erc20Predicate.lockTokens(
            bob /* depositor */,
            alice /* depositReceiver */,
            address(erc20Token),
            depositData
        );
    }

    function testLockTokensInsufficientAllowance() public {
        vm.prank(bob);
        erc20Token.mint(amt);
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        vm.prank(manager);
        erc20Predicate.lockTokens(
            bob /* depositor */,
            alice /* depositReceiver */,
            address(erc20Token),
            depositData
        );
    }

    function testExitTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("ERC20Predicate: INSUFFICIENT_PERMISSIONS");
        erc20Predicate.exitTokens(address(erc20Token), "0x");
    }

    function testExitTokensInsufficientTokensLocked() public {
        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                erc20Predicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC20: transfer amount exceeds balance"); // transfer from erc20Predicate to alice
        vm.prank(manager);
        erc20Predicate.exitTokens(address(erc20Token), res);
    }

    function testExitTokensInvalidSignature() public {
        vm.prank(manager);
        erc20Predicate.lockTokens(
            alice,
            bob,
            address(erc20Token),
            abi.encode(amt)
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                keccak256("0x1337") /* erc20Predicate.TRANSFER_EVENT_SIG() */
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC20Predicate: INVALID_SIGNATURE");
        vm.prank(manager);
        erc20Predicate.exitTokens(address(erc20Token), res);
    }

    function testExitTokensInvalidReceiver() public {
        vm.prank(manager);
        erc20Predicate.lockTokens(
            alice,
            bob,
            address(erc20Token),
            abi.encode(amt)
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                bob /* address(0) */,
                amt,
                erc20Predicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC20Predicate: INVALID_RECEIVER");
        vm.prank(manager);
        erc20Predicate.exitTokens(address(erc20Token), res);
    }

    function testExitTokens() public {
        assertEq(erc20Token.balanceOf(alice), amt);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), 0);

        vm.prank(manager);
        erc20Predicate.lockTokens(
            alice,
            bob,
            address(erc20Token),
            abi.encode(amt)
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                erc20Predicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        assertEq(erc20Token.balanceOf(alice), 0);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), amt);

        vm.expectEmit();
        emit ExitedERC20(alice, address(erc20Token), amt);
        vm.prank(manager);
        erc20Predicate.exitTokens(address(erc20Token), res);

        assertEq(erc20Token.balanceOf(alice), amt);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), 0);
    }
}
