// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "forge-std/Test.sol";

import {UChildUSDT0} from "scripts/helpers/interfaces/UChildUSDT0.generated.sol";
import {UpgradeToUSDT0} from "scripts/forge/upgrade-to-usdt0/UpgradeToUSDT0.s.sol";
import {UpdateImplementationMultisig} from "scripts/forge/update-impl-multisig/UpdateImplementationMultisig.s.sol";
import {TransferOwnership} from "scripts/forge/transfer-ownership/TransferOwnership.s.sol";

contract ForkUpgradeToUSDT0 is Test {
    UpgradeToUSDT0 public upgradeToUSDT0;
    UpdateImplementationMultisig public updateImplementationMultisig;
    TransferOwnership public transferOwnership;

    address balanceHolder = address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
    address multisig = address(0x3a635c48836E7c0B9aEB378640B0BfD516985cF5);
    address newAdmin = address(0x4DFF9b5b0143E642a3F63a5bcf2d1C328e600bf8);
    address newChildUSDT0Impl = address(0x90040487A6C9F949C4F07CaDCFB0f3B8EEAb4229);
    address newProxyOwner = address(0x4DFF9b5b0143E642a3F63a5bcf2d1C328e600bf8);
    address oftContract = address(0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13);
    address usdtProxy = address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

    Account deployer = makeAccount("deployer");

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("polygon_pos"), 75718151);

        upgradeToUSDT0 = new UpgradeToUSDT0();
        updateImplementationMultisig = new UpdateImplementationMultisig();
        transferOwnership = new TransferOwnership();
    }

    function testUpgradeToUSDT0() public {
        uint256 balanceBeforeUpgrade = UChildUSDT0(usdtProxy).balanceOf(balanceHolder);

        string memory inputs = _getUpgradeToUSDT0Inputs(newAdmin, oftContract);
        (, bytes memory initData) = upgradeToUSDT0.run(inputs);

        string memory updateInputs = _getUpdateImplInputs(usdtProxy, newChildUSDT0Impl, initData, multisig);
        (address newImplementation, bytes memory updateData) =
            updateImplementationMultisig.run(updateInputs, "UChildUSDT0");

        vm.prank(multisig);
        (bool success,) = usdtProxy.call(updateData);
        vm.assertTrue(success, "Upgrade to USDT0 failed");

        _verifyNewImplementation(newImplementation, usdtProxy);
        vm.assertEq(UChildUSDT0(usdtProxy).name(), "USDT0", "USDT0 name mismatch after upgrade");
        vm.assertEq(UChildUSDT0(usdtProxy).symbol(), "USDT0", "USDT0 symbol mismatch after upgrade");
        vm.assertEq(UChildUSDT0(usdtProxy).decimals(), 6, "USDT0 decimals mismatch after upgrade");
        vm.assertEq(UChildUSDT0(usdtProxy).USDT0_VERSION(), 1, "USDT0 version mismatch after upgrade");
        vm.assertEq(UChildUSDT0(usdtProxy).oftContract(), oftContract, "oftContract address mismatch after upgrade");

        uint256 balanceAfterUpgrade = UChildUSDT0(usdtProxy).balanceOf(balanceHolder);
        vm.assertEq(balanceAfterUpgrade, balanceBeforeUpgrade, "Balance mismatch after upgrade");
        vm.assertTrue(
            UChildUSDT0(usdtProxy).hasRole(UChildUSDT0(usdtProxy).DEFAULT_ADMIN_ROLE(), newAdmin),
            "New admin should have DEFAULT_ADMIN_ROLE"
        );

        string memory transferOwnershipInputs = _getTransferOwnershipInputs(multisig, newProxyOwner);
        (, bytes memory transferOwnershipData) = transferOwnership.run(transferOwnershipInputs);

        vm.prank(multisig);
        (bool transferSuccess,) = usdtProxy.call(transferOwnershipData);
        vm.assertTrue(transferSuccess, "Transfer ownership failed");

        (, bytes memory proxyOwnerData) = usdtProxy.call(abi.encodeWithSignature("proxyOwner()"));
        address proxyOwner = abi.decode(proxyOwnerData, (address));
        vm.assertEq(proxyOwner, newProxyOwner, "Proxy owner mismatch after transfer ownership");
    }

    function _getUpgradeToUSDT0Inputs(address _newAdmin, address _oftContract) internal returns (string memory) {
        string memory obj1 = "UUObject";
        vm.serializeAddress(obj1, "newAdmin", _newAdmin);
        string memory output = vm.serializeAddress(obj1, "oftContract", _oftContract);
        return output;
    }

    function _getUpdateImplInputs(
        address _proxyAddress,
        address _implementationAddress,
        bytes memory _updateData,
        address _multisig
    ) internal returns (string memory) {
        string memory obj1 = "UIObject";
        vm.serializeAddress(obj1, "proxyAddress", _proxyAddress);
        vm.serializeAddress(obj1, "implementationAddress", _implementationAddress);
        vm.serializeBytes(obj1, "updateData", _updateData);
        string memory output = vm.serializeAddress(obj1, "multisig", _multisig);
        return output;
    }

    function _getTransferOwnershipInputs(address _multisig, address _newOwner) internal returns (string memory) {
        string memory obj1 = "TOObject";
        vm.serializeAddress(obj1, "multisig", _multisig);
        string memory output = vm.serializeAddress(obj1, "newOwner", _newOwner);
        return output;
    }

    function _verifyNewImplementation(address expectedImplementation, address proxyAddress) internal {
        (, bytes memory returnData) = proxyAddress.call(abi.encodeWithSignature("implementation()"));
        address actualImplementation = abi.decode(returnData, (address));
        assertEq(actualImplementation, expectedImplementation, "New implementation address mismatch");
    }
}
