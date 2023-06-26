// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {ContextMixin} from "contracts/common/ContextMixin.sol";

contract ContextMixinTest is Test {
    ContextMixinMock internal contextMixin;

    function setUp() public {
        contextMixin = new ContextMixinMock();
    }

    function testMsgSender_NotMetaTransaction() public {
        assertEq(contextMixin.exposedMsgSender(), address(this));
    }

    function testMsgSender_MetaTransaction() public {
        address userAddress = makeAddr("userAddress");

        vm.prank(address(contextMixin));

        bytes memory msgData = abi.encodeWithSignature(
            "exposedMsgSender()",
            true,
            userAddress
        );

        (bool success, bytes memory retData) = address(contextMixin).call(
            msgData
        );
        require(success);

        assertEq(abi.decode(retData, (address)), userAddress);
    }
}

contract ContextMixinMock is ContextMixin {
    function exposedMsgSender() external view returns (address payable sender) {
        return msgSender();
    }
}
