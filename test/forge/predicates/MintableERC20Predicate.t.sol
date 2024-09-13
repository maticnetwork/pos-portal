// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";
import {MintableERC20PredicateProxy} from "contracts/root/TokenPredicates/MintableERC20PredicateProxy.sol";
import {MintableERC20Predicate} from "contracts/root/TokenPredicates/MintableERC20Predicate.sol";

import {DummyMintableERC20} from "contracts/root/RootToken/DummyMintableERC20.sol";

contract MintableERC20PredicateTest is Test {
    MintableERC20Predicate internal erc20Predicate;
    MintableERC20Predicate internal erc20PredicateImpl;

    DummyMintableERC20 internal erc20Token;
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal amt = 1e4 ether;

    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event LockedMintableERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    event ExitedMintableERC20(
        address indexed exitor,
        address indexed rootToken,
        uint256 amount
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        vm.startPrank(manager);

        erc20PredicateImpl = new MintableERC20Predicate();
        address erc20PredicateProxy = address(new MintableERC20PredicateProxy(address(erc20PredicateImpl)));
        erc20Predicate = MintableERC20Predicate(erc20PredicateProxy);

        erc20Token = new DummyMintableERC20("Test", "TST");
        erc20Predicate.initialize(manager);

        erc20Token.grantRole(
            erc20Token.PREDICATE_ROLE(),
            address(erc20Predicate)
        );

        // because it's a mintable ERC20, we're first going to exit it and
        // predicate will mint that much amount for us and send it back
        // to `depositor`, which is going to be approved to predicate, so that
        // it can get it transferred to itself
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
        bytes memory burnLog = vm.ffi(inputs);

        erc20Predicate.exitTokens(address(0x00), address(erc20Token), burnLog);
        vm.stopPrank();
        vm.prank(alice);
        erc20Token.approve(address(erc20Predicate), amt);
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

        address erc20PredicateProxy = address(new MintableERC20PredicateProxy(address(erc20PredicateImpl)));
        erc20Predicate = MintableERC20Predicate(erc20PredicateProxy);

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

    function testInitializeImpl() public {
        vm.expectRevert("already inited");
        erc20PredicateImpl.initialize(manager);

        erc20PredicateImpl = new MintableERC20Predicate();

        vm.expectRevert("already inited");
        erc20PredicateImpl.initialize(manager);
    }

    function testLockTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("MintableERC20Predicate: INSUFFICIENT_PERMISSIONS");
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
        emit LockedMintableERC20(alice, bob, address(erc20Token), amt);
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

    function testExitTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("MintableERC20Predicate: INSUFFICIENT_PERMISSIONS");
        erc20Predicate.exitTokens(address(0x00), address(erc20Token), "0x");
    }

    function testExitTokensMintInsufficientLockedTokens() public {
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
        bytes memory burnLog = vm.ffi(inputs);

        vm.expectEmit();
        emit Transfer(address(0), address(erc20Predicate), amt);
        vm.prank(manager);
        erc20Predicate.exitTokens(address(0x00), address(erc20Token), burnLog);
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

        vm.expectRevert("MintableERC20Predicate: INVALID_SIGNATURE");
        vm.prank(manager);
        erc20Predicate.exitTokens(address(0x00), address(erc20Token), res);
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

        vm.expectRevert("MintableERC20Predicate: INVALID_RECEIVER");
        vm.prank(manager);
        erc20Predicate.exitTokens(address(0x00), address(erc20Token), res);
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
        emit ExitedMintableERC20(alice, address(erc20Token), amt);
        vm.prank(manager);
        erc20Predicate.exitTokens(address(0x00), address(erc20Token), res);

        assertEq(erc20Token.balanceOf(alice), amt);
        assertEq(erc20Token.balanceOf(address(erc20Predicate)), 0);
    }
}
