// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {ChildChainManagerProxy} from "contracts/child/ChildChainManager/ChildChainManagerProxy.sol";

contract ChildChainManagerProxyTest is Test {
    ChildChainManagerProxy internal childChainManagerProxy;

    address implementationAddress;

    function setUp() public {
        implementationAddress = makeAddr("implementationAddress");
        childChainManagerProxy = new ChildChainManagerProxy(
            implementationAddress
        );
    }

    function testConstructor() public {
        assertEq(
            childChainManagerProxy.implementation(),
            implementationAddress
        );
    }
}
