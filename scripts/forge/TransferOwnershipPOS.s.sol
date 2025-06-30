// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "../../scripts/helpers/interfaces/UpgradableProxy.generated.sol";

/**
 * @title TransferOwnershipPOS
 * @notice This script generates calldata for the `transferOwnership` function of the UpgradableProxy contract.
 */
contract TransferOwnershipPOS is Script {
    string internal input = "scripts/forge/inputs.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal multisig = 0x355b8E02e7F5301E6fac9b7cAc1D6D9c86C0343f;

    address internal newOwner;
    address internal targetProxy;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (address, bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (address, bytes memory) {
        _readInputs();

        bytes memory data = abi.encodeCall(UpgradableProxy.transferProxyOwnership, (newOwner));

        console.log("--------------------------------------------------------------------\n");
        console.log("Send to Multisig: %s\n", multisig);
        console.log("--------------------------------------------------------------------\n");

        console.log("************************** CALLDATA START **************************\n");
        console.log("%s\n", vm.toString(data));
        console.log("************************** CALLDATA END **************************\n");

        return (newOwner, data);
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        newOwner = vm.parseJsonAddress(inputJson, ".transferOwnershipPOS.newOwner");
        targetProxy = vm.parseJsonAddress(inputJson, ".transferOwnershipPOS.targetProxy");


        _checkInputs();
    }

    function _checkInputs() internal view {
        require(targetProxy != address(0), "Target proxy cannot be zero");
        require(newOwner != address(0), "New owner cannot be zero");

        console.log("New Owner:", newOwner);
        console.log("Target Proxy:", targetProxy);
    }
}
