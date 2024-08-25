// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";
import {ERC1155Predicate} from "contracts/root/TokenPredicates/ERC1155Predicate.sol";
import {ERC1155PredicateProxy} from "contracts/root/TokenPredicates/ERC1155PredicateProxy.sol";
import {DummyERC1155} from "contracts/root/RootToken/DummyERC1155.sol";

contract ERC1155PredicateTest is Test {
    ERC1155Predicate internal erc1155Predicate;
    ERC1155Predicate internal erc1155PredicateImpl;
    DummyERC1155 internal erc1155Token;
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal tokenId = 0x1337;
    uint256 internal tokenId2 = tokenId % 2;
    uint256 internal amt = 1e4;

    uint256[] internal tokenIds = new uint256[](2);
    uint256[] internal amts = new uint256[](2);

    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event LockedBatchERC1155(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    event ExitedERC1155(
        address indexed exitor,
        address indexed rootToken,
        uint256 id,
        uint256 amount
    );

    event ExitedBatchERC1155(
        address indexed exitor,
        address indexed rootToken,
        uint256[] ids,
        uint256[] amounts
    );

    function setUp() public {
        erc1155Token = new DummyERC1155("ipfs://");
        vm.prank(manager);

        erc1155PredicateImpl = new ERC1155Predicate();
        address erc1155PredicateProxy = address(new ERC1155PredicateProxy(address(erc1155PredicateImpl)));
        erc1155Predicate = ERC1155Predicate(erc1155PredicateProxy);

        erc1155Predicate.initialize(manager);

        vm.startPrank(alice);
        erc1155Token.mint(alice, tokenId, amt);
        erc1155Token.mint(alice, tokenId2, amt);
        erc1155Token.setApprovalForAll(address(erc1155Predicate), true);
        vm.stopPrank();

        tokenIds[0] = tokenId;
        tokenIds[1] = tokenId2;
        amts[0] = amt;
        amts[1] = amt;
    }

    function testAliceBalanceAndApproval() public {
        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertTrue(
            erc1155Token.isApprovedForAll(alice, address(erc1155Predicate))
        );
        assertFalse(
            erc1155Token.isApprovedForAll(address(erc1155Predicate), alice)
        );
    }

    function testInitialize() public {
        vm.expectRevert("already inited");
        erc1155Predicate.initialize(manager);

        address erc1155PredicateProxy = address(new ERC1155PredicateProxy(address(erc1155PredicateImpl)));
        erc1155Predicate = ERC1155Predicate(erc1155PredicateProxy);

        vm.expectEmit();
        emit RoleGranted(
            erc1155Predicate.DEFAULT_ADMIN_ROLE(),
            manager,
            address(this)
        );
        vm.expectEmit();
        emit RoleGranted(
            erc1155Predicate.MANAGER_ROLE(),
            manager,
            address(this)
        );

        erc1155Predicate.initialize(manager);
    }

    function testInitializeImpl() public {
        vm.expectRevert("already inited");
        erc1155PredicateImpl.initialize(manager);

        erc1155PredicateImpl = new ERC1155Predicate();

        vm.expectRevert("already inited");
        erc1155PredicateImpl.initialize(manager);
    }

    function testLockTokensInvalidSender() public {
        bytes memory depositData = abi.encode(tokenIds, amts, new bytes(0));
        vm.expectRevert("ERC1155Predicate: INSUFFICIENT_PERMISSIONS");
        erc1155Predicate.lockTokens(
            alice /* depositor */,
            bob /* depositReceiver */,
            address(erc1155Token),
            depositData
        );
    }

    function testLockTokens() public {
        bytes memory depositData = abi.encode(tokenIds, amts, new bytes(0));

        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), amt);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            0
        );

        vm.expectEmit();
        emit LockedBatchERC1155(
            alice,
            bob,
            address(erc1155Token),
            tokenIds,
            amts
        );

        vm.prank(manager);
        erc1155Predicate.lockTokens(
            alice,
            bob,
            address(erc1155Token),
            depositData
        );

        assertEq(erc1155Token.balanceOf(alice, tokenId), 0);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId),
            amt
        );
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            amt
        );
        assertEq(erc1155Token.balanceOf(bob, tokenId), 0);
        assertEq(erc1155Token.balanceOf(bob, tokenId2), 0);
    }

    function testLockTokensInsufficientBalance() public {
        bytes memory depositData = abi.encode(tokenIds, amts, new bytes(0));
        vm.expectRevert("ERC1155: transfer caller is not owner nor approved");
        vm.prank(manager);
        erc1155Predicate.lockTokens(
            bob /* depositor */,
            alice /* depositReceiver */,
            address(erc1155Token),
            depositData
        );
    }

    function testExitTokensInvalidSender() public {
        bytes memory depositData = abi.encode(tokenIds, amts, new bytes(0));
        vm.expectRevert("ERC1155Predicate: INSUFFICIENT_PERMISSIONS");
        erc1155Predicate.exitTokens(address(erc1155Token), "0x");
    }

    function testExitTokensInsufficientTokensLocked() public {
        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc1155TransferSingle";
        inputs[4] = vm.toString(
            abi.encode(
                address(erc1155Predicate) /* operator */,
                alice,
                address(0),
                tokenId,
                amt,
                erc1155Predicate.TRANSFER_SINGLE_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC1155: insufficient balance for transfer"); // transfer from erc1155Predicate to alice
        vm.prank(manager);
        erc1155Predicate.exitTokens(address(erc1155Token), res);
    }

    function testExitTokensInvalidSignature() public {
        vm.prank(manager);
        erc1155Predicate.lockTokens(
            alice,
            bob,
            address(erc1155Token),
            abi.encode(tokenIds, amts, new bytes(0))
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc1155TransferSingle";
        inputs[4] = vm.toString(
            abi.encode(
                address(erc1155Predicate),
                alice,
                address(0),
                tokenId,
                amt,
                keccak256("0x1337") /* erc1155Predicate.TRANSFER_EVENT_SIG() */
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC1155Predicate: INVALID_WITHDRAW_SIG");
        vm.prank(manager);
        erc1155Predicate.exitTokens(address(erc1155Token), res);
    }

    function testExitTokensInvalidReceiver() public {
        vm.prank(manager);
        erc1155Predicate.lockTokens(
            alice,
            bob,
            address(erc1155Token),
            abi.encode(tokenIds, amts, new bytes(0))
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc1155TransferSingle";
        inputs[4] = vm.toString(
            abi.encode(
                address(erc1155Predicate) /* operator */,
                alice,
                bob /* address(0) */,
                tokenId,
                amt,
                erc1155Predicate.TRANSFER_SINGLE_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        vm.expectRevert("ERC1155Predicate: INVALID_RECEIVER");
        vm.prank(manager);
        erc1155Predicate.exitTokens(address(erc1155Token), res);
    }

    function testExitTokens() public {
        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), amt);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            0
        );

        vm.prank(manager);
        erc1155Predicate.lockTokens(
            alice,
            bob,
            address(erc1155Token),
            abi.encode(tokenIds, amts, new bytes(0))
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc1155TransferSingle";
        inputs[4] = vm.toString(
            abi.encode(
                address(erc1155Predicate),
                alice,
                address(0),
                tokenId,
                amt,
                erc1155Predicate.TRANSFER_SINGLE_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        assertEq(erc1155Token.balanceOf(alice, tokenId), 0);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId),
            amt
        );
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            amt
        );

        vm.expectEmit();
        emit ExitedERC1155(alice, address(erc1155Token), tokenId, amt);
        vm.prank(manager);
        erc1155Predicate.exitTokens(address(erc1155Token), res);

        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), 0);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            amt
        );
    }

    function testBatchExitTokens() public {
        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), amt);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            0
        );

        vm.prank(manager);
        erc1155Predicate.lockTokens(
            alice,
            bob,
            address(erc1155Token),
            abi.encode(tokenIds, amts, new bytes(0))
        );

        string[] memory inputs = new string[](5);
        inputs[0] = "npx";
        inputs[1] = "ts-node";
        inputs[2] = "test/forge/predicates/utils/rlpEncoder.ts";
        inputs[3] = "erc1155TransferBatch";
        inputs[4] = vm.toString(
            abi.encode(
                address(erc1155Predicate),
                alice,
                address(0),
                tokenIds,
                amts,
                erc1155Predicate.TRANSFER_BATCH_EVENT_SIG()
            )
        );
        bytes memory res = vm.ffi(inputs);

        assertEq(erc1155Token.balanceOf(alice, tokenId), 0);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId),
            amt
        );
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            amt
        );

        vm.expectEmit();
        emit ExitedBatchERC1155(alice, address(erc1155Token), tokenIds, amts);
        vm.prank(manager);
        erc1155Predicate.exitTokens(address(erc1155Token), res);

        assertEq(erc1155Token.balanceOf(alice, tokenId), amt);
        assertEq(erc1155Token.balanceOf(alice, tokenId2), amt);
        assertEq(erc1155Token.balanceOf(address(erc1155Predicate), tokenId), 0);
        assertEq(
            erc1155Token.balanceOf(address(erc1155Predicate), tokenId2),
            0
        );
    }
}
