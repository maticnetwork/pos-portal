// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {AccessControlMixin} from "scripts/helpers/interfaces/AccessControlMixin.generated.sol";

/**
 * @title GrantRole
 * @notice This script generates calldata for the `grantRole` function of the RootChainManager contract.
 */
contract GrantRole is Script {
    string internal input = "scripts/forge/grant-role/input.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    bytes32 internal role;
    address internal account;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (bytes memory) {
        _readInputs();

        bytes memory output = abi.encodeCall(AccessControlMixin.grantRole, (role, account));

        console.log("************************** CALLDATA START **************************\n");
        console.log(vm.toString(output), "\n");
        console.log("************************** CALLDATA END **************************\n");
        return output;
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        role = keccak256(abi.encodePacked(vm.parseJsonString(inputJson, ".role")));
        account = vm.parseJsonAddress(inputJson, ".account");
        _checkInputs();
    }

    function _checkInputs() internal view {
        require(role != bytes32(0), "Role is required");
        require(account != address(0), "Account is required");

        console.log("Role: %s", vm.toString(role));
        console.log("Account: %s", vm.toString(account));
    }
}
