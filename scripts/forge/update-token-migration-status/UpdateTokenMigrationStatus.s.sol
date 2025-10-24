// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {RootChainManager} from "scripts/helpers/interfaces/RootChainManager.generated.sol";

/**
 * @title UpdateTokenMigrationStatus
 * @notice This script generates calldata for the `updateTokenMigrationStatus` function of the RootChainManager contract.
 * @dev It supports updating the migration status of a token for deposits and exits.
 */
contract UpdateTokenMigrationStatus is Script {
    string internal input = "scripts/forge/update-token-migration-status/input.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal rootToken;
    uint256 internal lastExitBlockNumber;
    bool internal isDepositDisabled;
    bool internal isExitDisabled;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (bytes memory) {
        _readInputs();

        bytes memory data = abi.encodeCall(
            RootChainManager.updateTokenMigrationStatus,
            (rootToken, isDepositDisabled, isExitDisabled, lastExitBlockNumber)
        );

        console.log("************************** CALLDATA START **************************\n");
        console.log(vm.toString(data), "\n");
        console.log("************************** CALLDATA END **************************\n");
        return data;
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        rootToken = vm.parseJsonAddress(inputJson, ".rootToken");
        isDepositDisabled = vm.parseJsonBool(inputJson, ".isDepositDisabled");
        isExitDisabled = vm.parseJsonBool(inputJson, ".isExitDisabled");
        lastExitBlockNumber = vm.parseJsonUint(inputJson, ".lastExitBlockNumber");

        _checkInputs();

        console.log("Generating calldata for updateTokenMigrationStatus ...");
        console.log("Root Token: %s", rootToken);
        console.log("Is Deposit Disabled: %s", isDepositDisabled);
        console.log("Is Exit Disabled: %s", isExitDisabled);
        console.log("Last Exit Block Number: %s\n", vm.toString(lastExitBlockNumber));
    }

    function _checkInputs() internal view {
        require(rootToken != address(0), "Root token address cannot be zero");
        require(isDepositDisabled || isExitDisabled, "At least one migration status must be true");
        if (isExitDisabled) {
            require(lastExitBlockNumber > 0, "Last exit block number must be greater than zero if exit is disabled");
        }
    }
}
