// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {AccessControlMixin} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildERC20.sol";
import {ContextMixin} from "contracts/common/ContextMixin.sol";
import {NativeMetaTransaction} from "contracts/common/NativeMetaTransaction.sol";

contract AccessControlMixinTest is Test, NMTHelpers {
    bytes32 constant ROLE = keccak256("role");

    AccessControlMixinMock internal accessControlMixin;

    Account internal signer;

    function setUp() public {
        signer = makeAccount("signer");

        accessControlMixin = new AccessControlMixinMock(signer.addr);
        accessControlMixin.exposed_setupContractId("contractId");
    }

    function testCannotOnly_InsufficientPermissions() public {
        vm.expectRevert("contractId: INSUFFICIENT_PERMISSIONS");

        accessControlMixin.exposedOnly(ROLE);
    }

    function testCannotOnly_InsufficientPermissions_MetaTx() public {
        expectMetaTransactionRevert(
            address(accessControlMixin),
            abi.encodeWithSelector(
                accessControlMixin.exposedOnly.selector,
                ROLE
            ),
            makeAccount("randomAccount")
        );
    }

    function testOnly() public {
        executeMetaTransaction(
            address(accessControlMixin),
            abi.encodeWithSelector(
                accessControlMixin.exposedOnly.selector,
                ROLE
            ),
            signer
        );
    }
}

contract AccessControlMixinMock is
    AccessControlMixin,
    ContextMixin,
    NativeMetaTransaction
{
    constructor(address who) public {
        _setupRole(keccak256("role"), who);
    }

    function exposed_setupContractId(string calldata contractId) external {
        _setupContractId(contractId);
    }

    function exposedOnly(bytes32 role) external only(role) {}

    function _msgSender()
        internal
        view
        override
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }
}
