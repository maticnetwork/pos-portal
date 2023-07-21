// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";

import {UpgradableProxy} from "contracts/common/Proxy/UpgradableProxy.sol";

contract UpgradableProxyTest is Test {
    event ProxyUpdated(address indexed _new, address indexed _old);
    event ProxyOwnerUpdate(address _new, address _old);

    UpgradableProxy internal upgradableProxy;
    DummyImplementation internal implementation;

    address internal immutable ALIEN = makeAddr("alien");

    function setUp() public virtual {
        implementation = new DummyImplementation();
        upgradableProxy = new UpgradableProxy(address(implementation));
    }

    function testProxyType() public {
        assertEq(upgradableProxy.proxyType(), 2);
    }

    function testConstructor() public {
        assertEq(upgradableProxy.proxyOwner(), address(this));
        assertEq(upgradableProxy.implementation(), address(implementation));
    }

    function testFallback() public {
        bytes memory msgData = abi.encodeWithSelector(implementation.mirror.selector, "anything");
        uint256 value = 1 ether;

        (bool succ, bytes memory retData) = address(upgradableProxy).call{value: value}(msgData);
        require(succ);

        bytes memory mirroredRetData = abi.decode(retData, (bytes));

        assertEq(mirroredRetData, msgData);
        assertEq(address(upgradableProxy).balance, value);
    }

    function testReceive() public {
        uint256 value = 1 ether;

        (bool succ, bytes memory retData) = address(upgradableProxy).call{value: value}("");
        require(succ);

        assertEq(retData.length, 0);
        assertEq(address(upgradableProxy).balance, value);
    }

    function testProxyOwner() public {
        assertEq(upgradableProxy.proxyOwner(), address(this));
    }

    function testCannotTransferProxyOwnership_NotOwner() public {
        vm.prank(ALIEN);

        vm.expectRevert("NOT_OWNER");

        upgradableProxy.transferProxyOwnership(address(0));
    }

    function testTransferProxyOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit();
        emit ProxyOwnerUpdate(newOwner, address(this));

        upgradableProxy.transferProxyOwnership(newOwner);

        assertEq(upgradableProxy.proxyOwner(), newOwner);
    }

    function testCannotUpdateImplementation_NotOwner() public {
        vm.prank(ALIEN);

        vm.expectRevert("NOT_OWNER");

        upgradableProxy.updateImplementation(address(0));
    }

    function testCannotUpdateImplementation_NotContract() public {
        vm.expectRevert("DESTINATION_ADDRESS_IS_NOT_A_CONTRACT");

        upgradableProxy.updateImplementation(address(0));
    }

    function testUpdateImplementation() public {
        DummyImplementation newImplementation = new DummyImplementation();

        vm.recordLogs();

        upgradableProxy.updateImplementation(address(newImplementation));

        Vm.Log memory log = vm.getRecordedLogs()[0];

        assertEq(upgradableProxy.implementation(), address(newImplementation));

        assertEq(log.topics[0], keccak256("ProxyUpdated(address,address)"));
        assertEq(log.topics[1], bytes32(uint256(address(newImplementation))));
        assertEq(log.topics[2], bytes32(uint256(address(implementation))));
    }

    function testCannotUpdateAndCall_CallFailed() public {
        DummyImplementation newImplementation = new DummyImplementation();

        vm.expectRevert();

        upgradableProxy.updateAndCall(address(newImplementation), hex"00");
    }

    function testUpdateAndCall() public {
        DummyImplementation newImplementation = new DummyImplementation();

        bytes memory msgData = abi.encodeWithSelector(implementation.mirror.selector);
        uint256 value = 1 ether;

        vm.expectEmit();
        emit ProxyUpdated(address(newImplementation), address(implementation));

        upgradableProxy.updateAndCall{value: value}(address(newImplementation), msgData);

        assertEq(upgradableProxy.implementation(), address(newImplementation));
        assertTrue(DummyImplementation(address(upgradableProxy)).mirrored());
        assertEq(address(upgradableProxy).balance, value);
    }
}

contract DummyImplementation {
    bool public mirrored;

    receive() external payable {}

    function mirror() public payable returns (bytes memory msgData) {
        mirrored = true;
        msgData = msg.data;
    }

    function clearMirror() public {
        mirrored = false;
    }
}
