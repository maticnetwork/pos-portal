// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "forge-std/Test.sol";

import {UChildUSDT0} from "scripts/helpers/interfaces/UChildUSDT0.generated.sol";
import {UpgradeToUSDT0} from "../../scripts/forge/UpgradeToUSDT0.s.sol";
import {UpdateImplementationPOS} from "../../scripts/forge/UpdateImplementationPOS.s.sol";
import {TransferOwnershipPOS} from "../../scripts/forge/TransferOwnershipPOS.s.sol";

contract ForkUpgradeToUSDT0 is Test {
    UpgradeToUSDT0 public upgradeToUSDT0;
    UpdateImplementationPOS public updateImplementationPOS;
    TransferOwnershipPOS public transferOwnershipPOS;

    address balanceHolder = address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
    address multisig = address(0x3a635c48836E7c0B9aEB378640B0BfD516985cF5);
    address newAdmin = address(0x4DFF9b5b0143E642a3F63a5bcf2d1C328e600bf8);
    address newChildUSDT0Impl = address(0x90040487A6C9F949C4F07CaDCFB0f3B8EEAb4229);
    address newProxyOwner = address(0x4DFF9b5b0143E642a3F63a5bcf2d1C328e600bf8);
    address oftContract = address(0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13);
    address usdtProxy = address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

    Account deployer = makeAccount("deployer");
    string contractName = "UChildUSDT0";

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("polygon_pos"));

        upgradeToUSDT0 = new UpgradeToUSDT0();
        updateImplementationPOS = new UpdateImplementationPOS();
        transferOwnershipPOS = new TransferOwnershipPOS();
    }

    function testUpgradeToUSDT0() public {
        uint256 balanceBeforeUpgrade = UChildUSDT0(usdtProxy).balanceOf(balanceHolder);

        string memory inputs = _getUpgradeToUSDT0Inputs(newAdmin, oftContract);
        (, bytes memory initData) = upgradeToUSDT0.run(inputs);

        string memory updateInputs = _getUpdateImplInputs(contractName, usdtProxy, newChildUSDT0Impl, initData);
        (address newImplementation, bytes memory updateData) = updateImplementationPOS.run(updateInputs);

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

        string memory transferOwnershipInputs = _getTransferOwnershipInputs(newProxyOwner);
        (, bytes memory transferOwnershipData) = transferOwnershipPOS.run(transferOwnershipInputs);

        vm.prank(multisig);
        (bool transferSuccess,) = usdtProxy.call(transferOwnershipData);
        vm.assertTrue(transferSuccess, "Transfer ownership failed");

        (,bytes memory proxyOwnerData) = usdtProxy.call(abi.encodeWithSignature("proxyOwner()"));
        address proxyOwner = abi.decode(proxyOwnerData, (address));
        vm.assertEq(proxyOwner, newProxyOwner, "Proxy owner mismatch after transfer ownership");
    }

    function _getUpgradeToUSDT0Inputs(address _newAdmin, address _oftContract) internal returns (string memory) {
        string memory obj1 = "UUObject";
        string memory obj2 = "UUValueObject";
        vm.serializeAddress(obj2, "newAdmin", _newAdmin);
        string memory output = vm.serializeAddress(obj2, "oftContract", _oftContract);
        return vm.serializeString(obj1, "upgradeToUSDT0", output);
    }

    function _getUpdateImplInputs(string memory _contractName, address _proxyAddress, address _implementationAddress, bytes memory _updateData)
        internal
        returns (string memory)
    {
        string memory obj1 = "UIObject";
        string memory obj2 = "UIValueObject";
        vm.serializeString(obj2, "contractName", _contractName);
        vm.serializeAddress(obj2, "proxyAddress", _proxyAddress);
        vm.serializeAddress(obj2, "implementationAddress", _implementationAddress);
        string memory output = vm.serializeBytes(obj2, "updateData", _updateData);
        return vm.serializeString(obj1, "upgradeImplementationPOS", output);
    }

    function _getTransferOwnershipInputs(address _newOwner) internal returns (string memory) {
        string memory obj1 = "TOObject";
        string memory obj2 = "TOValueObject";
        string memory output = vm.serializeAddress(obj2, "newOwner", _newOwner);
        return vm.serializeString(obj1, "transferOwnershipPOS", output);
    }

    function _verifyNewImplementation(address expectedImplementation, address proxyAddress) internal {
        (, bytes memory returnData) = proxyAddress.call(abi.encodeWithSignature("implementation()"));
        address actualImplementation = abi.decode(returnData, (address));
        assertEq(actualImplementation, expectedImplementation, "New implementation address mismatch");
    }
}
