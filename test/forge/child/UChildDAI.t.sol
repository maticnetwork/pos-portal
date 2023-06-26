// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {UChildDAI} from "contracts/child/ChildToken/DappTokens/UChildDAI.sol";

contract UChildDAITest is Test {
    UChildDAI internal uChildDAI;

    Account holder;
    address spender;

    uint256 nonce;

    uint256 expiry;
    bool allowed;

    function setUp() public virtual {
        vm.warp(1641070800);

        uChildDAI = new UChildDAI();

        holder = makeAccount("holder");
        spender = makeAddr("spender");
        nonce = uChildDAI.getNonce(holder.addr);
        expiry = block.timestamp + 1 days;
        allowed = true;
    }

    function testCannotPermit_HolderZero() public {
        vm.expectRevert("UChildDAI: HOLDER-ZERO");

        uChildDAI.permit(
            address(0),
            address(0),
            0,
            0,
            false,
            uint8(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function testCannotPermit_InvalidPermit() public {
        vm.expectRevert("UChildDAI: INVALID-PERMIT");

        uChildDAI.permit(
            holder.addr,
            address(0),
            0,
            0,
            false,
            uint8(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function testCannotPermit_PermitExpired() public {
        expiry = block.timestamp - 1;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        nonce,
                        expiry,
                        false
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.expectRevert("UChildDAI: PERMIT-EXPIRED");

        uChildDAI.permit(holder.addr, spender, nonce, expiry, false, v, r, s);
    }

    function testCannotPermit_InvalidNonce() public {
        uint256 invalidNonce = nonce + 1;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        invalidNonce,
                        expiry,
                        false
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.expectRevert("UChildDAI: INVALID-NONCE");

        uChildDAI.permit(
            holder.addr,
            spender,
            invalidNonce,
            expiry,
            false,
            v,
            r,
            s
        );
    }

    function testCannotPermit_MetaTx() public {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        nonce,
                        expiry,
                        false
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        vm.prank(address(uChildDAI));

        vm.expectRevert("UChildDAI: PERMIT_META_TX_DISABLED");

        uChildDAI.permit(holder.addr, spender, nonce, expiry, false, v, r, s);
    }

    function testPermit() public {
        // Allowed; expiry at a future date.

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        nonce,
                        expiry,
                        allowed
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        uChildDAI.permit(holder.addr, spender, nonce, expiry, allowed, v, r, s);

        assertEq(uChildDAI.allowance(holder.addr, spender), uint256(-1));
        assertEq(uChildDAI.getNonce(holder.addr), nonce + 1);

        // Disallowed; expiry indefinite.

        ++nonce;

        expiry = 0;
        allowed = false;

        digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        nonce,
                        expiry,
                        allowed
                    )
                )
            )
        );

        (v, r, s) = vm.sign(holder.key, digest);

        uChildDAI.permit(holder.addr, spender, nonce, expiry, allowed, v, r, s);

        assertEq(uChildDAI.allowance(holder.addr, spender), 0);
    }

    function testAliases() public {
        // holder approves spender

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        spender,
                        nonce,
                        expiry,
                        allowed
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);

        uChildDAI.permit(holder.addr, spender, nonce, expiry, allowed, v, r, s);

        // holder approves self

        ++nonce;

        digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                uChildDAI.getDomainSeperator(),
                keccak256(
                    abi.encode(
                        uChildDAI.PERMIT_TYPEHASH(),
                        holder.addr,
                        holder.addr,
                        nonce,
                        expiry,
                        allowed
                    )
                )
            )
        );

        (v, r, s) = vm.sign(holder.key, digest);

        uChildDAI.permit(
            holder.addr,
            holder.addr,
            nonce,
            expiry,
            allowed,
            v,
            r,
            s
        );

        uint256 amount = 1e18;

        deal(address(uChildDAI), holder.addr, amount * 10);
        deal(address(uChildDAI), spender, amount * 10);

        address recipient = makeAddr("recipient");

        uint256 holderBalance = uChildDAI.balanceOf(holder.addr);
        uint256 recipientBalance = uChildDAI.balanceOf(recipient);
        uint256 spenderBalance = uChildDAI.balanceOf(spender);

        vm.startPrank(holder.addr);

        // from self

        uChildDAI.push(recipient, amount);

        holderBalance -= amount;
        recipientBalance += amount;

        assertEq(uChildDAI.balanceOf(holder.addr), holderBalance);
        assertEq(uChildDAI.balanceOf(recipient), recipientBalance);

        // to self

        vm.startPrank(spender);

        uChildDAI.pull(holder.addr, amount);

        holderBalance -= amount;
        spenderBalance += amount;

        assertEq(uChildDAI.balanceOf(holder.addr), holderBalance);
        assertEq(uChildDAI.balanceOf(spender), spenderBalance);

        // arbitrary

        vm.startPrank(spender);

        uChildDAI.move(holder.addr, recipient, amount);

        holderBalance -= amount;
        recipientBalance += amount;

        assertEq(uChildDAI.balanceOf(holder.addr), holderBalance);
        assertEq(uChildDAI.balanceOf(recipient), recipientBalance);
    }
}
