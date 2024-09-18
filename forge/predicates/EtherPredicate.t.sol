// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "lib/forge-std/src/Test.sol";
import {EtherPredicate} from "contracts/root/TokenPredicates/EtherPredicate.sol";
import {EtherPredicateProxy} from "contracts/root/TokenPredicates/EtherPredicateProxy.sol";

contract EtherPredicateTest is Test {
    EtherPredicate internal etherPredicate;
    EtherPredicate internal etherPredicateImpl;
    address internal etherAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal amt = 1e4 ether;

    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event LockedEther(
        address indexed depositor,
        address indexed depositReceiver,
        uint256 amount
    );

    event ExitedEther(address indexed exitor, uint256 amount);

    function setUp() public {
        etherPredicateImpl = new EtherPredicate();
        address payable etherPredicateProxy = payable(new EtherPredicateProxy(address(etherPredicateImpl)));
        etherPredicate = EtherPredicate(etherPredicateProxy);

        vm.prank(manager);
        etherPredicate.initialize(manager);
    }

    function testInitialize() public {
        vm.expectRevert("already inited");
        etherPredicate.initialize(manager);

        address payable etherPredicateProxy = payable(new EtherPredicateProxy(address(etherPredicateImpl)));
        etherPredicate = EtherPredicate(etherPredicateProxy);

        vm.expectEmit();
        emit RoleGranted(
            etherPredicate.DEFAULT_ADMIN_ROLE(),
            manager,
            address(this)
        );
        vm.expectEmit();
        emit RoleGranted(etherPredicate.MANAGER_ROLE(), manager, address(this));

        etherPredicate.initialize(manager);
    }

     function testInitializeImpl() public {
        vm.expectRevert("already inited");
        etherPredicateImpl.initialize(manager);

        etherPredicateImpl = new EtherPredicate();

        vm.expectRevert("already inited");
        etherPredicateImpl.initialize(manager);
    }

    function testLockTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("EtherPredicate: INSUFFICIENT_PERMISSIONS");
        etherPredicate.lockTokens(
            alice /* depositor */,
            bob /* depositReceiver */,
            etherAddress,
            depositData
        );
    }

    function testLockTokens() public {
        bytes memory depositData = abi.encode(amt);

        vm.expectEmit();
        emit LockedEther(alice, bob, amt);

        vm.prank(manager);
        etherPredicate.lockTokens(alice, bob, etherAddress, depositData);
    }

    function testExitTokensInvalidSender() public {
        bytes memory depositData = abi.encode(amt);
        vm.expectRevert("EtherPredicate: INSUFFICIENT_PERMISSIONS");
        etherPredicate.exitTokens(address(0x00), etherAddress, "0x");
    }

    function testExitTokensInsufficientEtherBalance() public {
        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer"; // same Transfer event signature
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                etherPredicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("EtherPredicate: ETHER_TRANSFER_FAILED");
        vm.prank(manager);
        etherPredicate.exitTokens(address(0x00), etherAddress, res);
    }

    function testExitTokensInvalidSignature() public {
        vm.prank(manager);
        etherPredicate.lockTokens(alice, bob, etherAddress, abi.encode(amt));

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                keccak256("0x1337") /* etherPredicate.TRANSFER_EVENT_SIG() */
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("EtherPredicate: INVALID_SIGNATURE");
        vm.prank(manager);
        etherPredicate.exitTokens(address(0x00), etherAddress, res);
    }

    function testExitTokensInvalidReceiver() public {
        vm.prank(manager);
        etherPredicate.lockTokens(alice, bob, etherAddress, abi.encode(amt));

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                bob /* address(0) */,
                amt,
                etherPredicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("EtherPredicate: INVALID_RECEIVER");
        vm.prank(manager);
        etherPredicate.exitTokens(address(0x00), etherAddress, res);
    }

    function testExitTokens() public {
        vm.prank(manager);
        etherPredicate.lockTokens(alice, bob, etherAddress, abi.encode(amt));

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc20Transfer";
        inputs[4] = vm.toString(
            abi.encode(
                alice,
                address(0),
                amt,
                etherPredicate.TRANSFER_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        assertEq(alice.balance, 0);
        vm.deal(address(etherPredicate), amt);
        assertEq(address(etherPredicate).balance, amt);

        vm.expectEmit();
        emit ExitedEther(alice, amt);
        vm.prank(manager);
        etherPredicate.exitTokens(address(0x00), etherAddress, res);

        assertEq(alice.balance, amt);
        assertEq(address(etherPredicate).balance, 0);
    }
}
