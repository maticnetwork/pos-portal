// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";

/**
 * @title UpgradeToUSDT0
 * @notice This script generates calldata for the `upgradeToUSDT0` function of the new USDT0 contract.
 */
contract UpgradeToUSDT0 is Script {
    string internal input = "scripts/forge/upgrade-to-usdt0/input.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal newAdmin;
    address internal oftContract;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (address, bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (address, bytes memory) {
        _readInputs();

        bytes memory data = abi.encodeWithSignature(
            "upgradeToUSDT0(address,address)",
            newAdmin,
            oftContract
        );

        console.log("************************** CALLDATA START **************************\n");
        console.log("%s\n", vm.toString(data));
        console.log("************************** CALLDATA END **************************\n");

        return (newAdmin, data);
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        newAdmin = vm.parseJsonAddress(inputJson, ".newAdmin");
        oftContract = vm.parseJsonAddress(inputJson, ".oftContract");


        _checkInputs();
    }

    function _checkInputs() internal view {
        require(newAdmin != address(0), "New admin cannot be zero");
        require(oftContract != address(0), "OFT contract cannot be zero");

        console.log("New Admin: %s", newAdmin);
        console.log("OFT Contract: %s\n", oftContract);
    }
}
