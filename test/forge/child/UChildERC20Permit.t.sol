// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {UChildERC20Permit} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildERC20Permit.sol";

/**
 * @title UChildERC20Permit EIP2612 Test
 * @author KaizenDeveloperA
 * @notice UChildERC20 template with EIP-3009 (https://eips.ethereum.org/EIPS/eip-3009)
 */
contract UChildPermitTest is Test {
  event Permit2AllowanceUpdated(bool enabled);
  UChildERC20Permit internal uChildERC20Permit;
  Account holder;
  address spender;
  address permit2revoker;
  address childChainManager;
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256(
      "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

  function setUp() public virtual {
    vm.warp(1641070800);
    permit2revoker = makeAddr("permit2revoker");
    holder = makeAccount("holder");
    spender = makeAddr("spender");
    childChainManager = makeAddr("childChainManager");
    uChildERC20Permit = new UChildERC20Permit(permit2revoker);
    uChildERC20Permit.initialize(
      "Name",
      "Symbol",
      18,
      childChainManager
    );
  }

  function test_TypeHash() public {
    assertEq(uChildERC20Permit.PERMIT_TYPEHASH(), PERMIT_TYPEHASH);
  }

  function test_PermitWithValidSignature() public {
    deal(address(uChildERC20Permit), holder.addr, 2 ether);
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        uChildERC20Permit.DOMAIN_SEPARATOR(),
        keccak256(
          abi.encode(
            uChildERC20Permit.PERMIT_TYPEHASH(),
            holder.addr,
            spender,
            2 ether,
            1,
            block.timestamp + 1 days
          )
        )
      )
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);
    uChildERC20Permit.permit(
      holder.addr,
      spender,
      2 ether,
      block.timestamp + 1 days,
      v,
      r,
      s
    );
    assertEq(uChildERC20Permit.allowance(holder.addr, spender), 2 ether);
    vm.startPrank(spender);
    uChildERC20Permit.transferFrom(holder.addr, spender, 2 ether);
    assertEq(uChildERC20Permit.balanceOf( spender), 2 ether);
    // a nonce can not be used twice
    digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        uChildERC20Permit.DOMAIN_SEPARATOR(),
        keccak256(
          abi.encode(
            uChildERC20Permit.PERMIT_TYPEHASH(),
            holder.addr,
            spender,
            2 ether,
            1,
            block.timestamp + 1 days
          )
        )
      )
    );
    (v, r, s) = vm.sign(holder.key, digest);
    vm.expectRevert("UChildERC20Permit: invalid signature");
    uChildERC20Permit.permit(
      holder.addr,
      spender,
      2 ether,
      block.timestamp + 1 days,
      v,
      r,
      s
    );
  }

  function testFail_PermitWithInvalidSignature() public {
    // Invalid deadline
    deal(address(uChildERC20Permit), holder.addr, 20 ether);
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        uChildERC20Permit.DOMAIN_SEPARATOR(),
        keccak256(
          abi.encode(
            uChildERC20Permit.PERMIT_TYPEHASH(),
            holder.addr,
            spender,
            10 ether,
            1,
            block.timestamp - 1 days
          )
        )
      )
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(holder.key, digest);
    vm.expectRevert("UChildERC20Permit: permit expired");
    uChildERC20Permit.permit(
      holder.addr,
      spender,
      10 ether,
      block.timestamp + 1 days,
      v,
      r,
      s
    );

    // // Invalid nonce
    digest = keccak256(
      abi.encodePacked(
        uChildERC20Permit.DOMAIN_SEPARATOR(),
        keccak256(
          abi.encode(
            "\x19\x01",
            uChildERC20Permit.PERMIT_TYPEHASH(),
            holder.addr,
            spender,
            10 ether,
            0,
            block.timestamp + 1 days
          )
        )
      )
    );
    (v, r, s) = vm.sign(holder.key, digest);
    vm.expectRevert("UChildERC20Permit: invalid signature");
    uChildERC20Permit.permit(
      holder.addr,
      spender,
      10 ether,
      block.timestamp + 1 days,
      v,
      r,
      s
    );
  }

  function testFail_Permit2Revoke(address user) external {

    vm.assume(user != permit2revoker);
    vm.startPrank(user);
    vm.expectRevert("Assertion failed.");
    uChildERC20Permit.updatePermit2Allowance(false);
  }

  function test_RevokePermit2Allowance(address owner) external {
    assertEq(uChildERC20Permit.allowance(owner, uChildERC20Permit.PERMIT2()), uint256(-1));
    vm.prank(permit2revoker);
    vm.expectEmit(true, true, true, true);
    emit Permit2AllowanceUpdated(false);
    uChildERC20Permit.updatePermit2Allowance(false);
    assertFalse(uChildERC20Permit.permit2Enabled());
    assertEq(
      uChildERC20Permit.allowance(owner, uChildERC20Permit.PERMIT2()),
      0
    );
  }
}
