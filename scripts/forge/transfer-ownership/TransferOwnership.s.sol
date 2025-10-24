// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "scripts/helpers/interfaces/UpgradableProxy.generated.sol";

/**
 * @title TransferOwnership
 * @notice This script generates calldata for the `transferOwnership` function of the UpgradableProxy contract.
 */
contract TransferOwnership is Script {
    string internal input = "scripts/forge/transfer-ownership/input.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal newOwner;
    address internal previousOwner;

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
        console.log("Send to: %s\n", previousOwner);
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
        previousOwner = vm.parseJsonAddress(inputJson, ".previousOwner");
        newOwner = vm.parseJsonAddress(inputJson, ".newOwner");

        _checkInputs();
    }

    function _checkInputs() internal view {
        require(previousOwner != address(0), "previousOwner address cannot be zero");
        require(newOwner != address(0), "New owner cannot be zero");

        console.log("New Owner:", newOwner);
    }
}
