// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {UChildEIP3009} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildEIP3009.sol";

/**
 * @title UChildERC20 EIP3009 Test
 * @author sepyke.eth
 * @notice UChildERC20 template with EIP-3009 (https://eips.ethereum.org/EIPS/eip-3009)
 */
contract UChildEIP3009Test is Test {
    UChildEIP3009 internal uChildEIP3009;
    Account holder;
    address spender;

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = keccak256(
        "CancelAuthorization(address authorizer,bytes32 nonce)"
    );

    function setUp() public virtual {
        vm.warp(1641070800);

        uChildEIP3009 = new UChildEIP3009();

        holder = makeAccount("holder");
        spender = makeAddr("spender");
    }

    function testTypeHash() public {
        assertEq(uChildEIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), TRANSFER_WITH_AUTHORIZATION_TYPEHASH);
        assertEq(uChildEIP3009.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), RECEIVE_WITH_AUTHORIZATION_TYPEHASH);
        assertEq(uChildEIP3009.CANCEL_AUTHORIZATION_TYPEHASH(), CANCEL_AUTHORIZATION_TYPEHASH);
    }

    function testTransferWithInvalidAuthorization() public {
        // Invalid validAfter
        bytes32 nonce = keccak256("randomNonce");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        block.timestamp + 1 days,
                        block.timestamp + 7 days,
                        nonce
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.transferWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            block.timestamp + 1 days,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );

        // Invalid validBefore
        nonce = keccak256("randomNonce");
        digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        0,
                        block.timestamp - 7 days,
                        nonce
                    )
                )
            )
        );

        (v, r, s) = vm.sign(holder.key, digest);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.transferWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp - 7 days,
            nonce,
            v,
            r,
            s
        );
    }

    function testTransferWithValidAuthorization() public {
        deal(address(uChildEIP3009), holder.addr, 1 ether);

        bytes32 nonce = keccak256("randomNonce");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        0,
                        block.timestamp + 7 days,
                        nonce
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.startPrank(spender);
        uChildEIP3009.transferWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );
        assertEq(uChildEIP3009.balanceOf(spender), 1 ether);
        assertEq(uChildEIP3009.balanceOf(holder.addr), 0);
        vm.stopPrank();

        // Spender cannot re-use the nonce
        vm.startPrank(spender);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.transferWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );
        vm.stopPrank();
    }

    function testReceiveWithInvalidAuthorization() public {
        // Invalid validAfter
        bytes32 nonce = keccak256("randomNonce");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        block.timestamp + 1 days,
                        block.timestamp + 7 days,
                        nonce
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);
        vm.startPrank(spender);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.receiveWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            block.timestamp + 1 days,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );
        vm.stopPrank();

        // Invalid validBefore
        digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        0,
                        block.timestamp - 7 days,
                        nonce
                    )
                )
            )
        );

        (v, r, s) = vm.sign(holder.key, digest);
        vm.startPrank(spender);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.receiveWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp - 7 days,
            nonce,
            v,
            r,
            s
        );
        vm.stopPrank();

        // Invalid msg.sender
        vm.expectRevert("EIP3009: caller must be recipient");
        uChildEIP3009.receiveWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp - 7 days,
            nonce,
            v,
            r,
            s
        );
    }

    function testReceiveWithValidAuthorization() public {
        deal(address(uChildEIP3009), holder.addr, 1 ether);

        bytes32 nonce = keccak256("randomNonce");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        spender,
                        1 ether,
                        0,
                        block.timestamp + 7 days,
                        nonce
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.startPrank(spender);
        uChildEIP3009.receiveWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );
        assertEq(uChildEIP3009.balanceOf(spender), 1 ether);
        assertEq(uChildEIP3009.balanceOf(holder.addr), 0);
        vm.stopPrank();

        // Spender cannot re-use the nonce
        vm.startPrank(spender);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.receiveWithAuthorization(
            holder.addr,
            spender,
            1 ether,
            0,
            block.timestamp + 7 days,
            nonce,
            v,
            r,
            s
        );
        vm.stopPrank();
    }

    function testCancelAuthorization() public {
        bytes32 nonce = keccak256("randomNonce");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildEIP3009.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildEIP3009.CANCEL_AUTHORIZATION_TYPEHASH(),
                        holder.addr,
                        nonce
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.startPrank(spender);
        uChildEIP3009.cancelAuthorization(
            holder.addr,
            nonce,
            v,
            r,
            s
        );
        assertEq(uChildEIP3009.authorizationState(holder.addr, nonce), true);
        vm.stopPrank();

        // Spender cannot re-use the nonce
        vm.startPrank(spender);
        vm.expectRevert("EIP3009: authorization invalid");
        uChildEIP3009.cancelAuthorization(
            holder.addr,
            nonce,
            v,
            r,
            s
        );
        vm.stopPrank();
    }
}