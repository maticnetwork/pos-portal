// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";

import {UChildERC20Proxy} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildERC20Proxy.sol";

contract UChildERC20ProxyTest is Test {
    address internal implementation;

    UChildERC20Proxy internal ucerc20Proxy;

    function setUp() public virtual {
        implementation = makeAddr("implementation");

        ucerc20Proxy = new UChildERC20Proxy(implementation);
    }

    function testConstructor() public {
        assertEq(ucerc20Proxy.proxyOwner(), address(this));
        assertEq(ucerc20Proxy.implementation(), implementation);
    }
}
