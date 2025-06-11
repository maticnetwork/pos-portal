// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "../../scripts/helpers/interfaces/UpgradableProxy.generated.sol";
import {TimelockController} from "@openzeppelin-v5/governance/TimelockController.sol";

/**
 * @title UpdateImplementation
 * @notice This script generates calldata for the `updateImplementation` function of the UpgradableProxy contract.
 */
contract UpdateImplementation is Script {
    string internal input = "scripts/forge/inputs.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal newImplementation;
    address internal proxyAddress;
    uint256 internal delay;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (bytes memory, bytes memory, bytes32) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (bytes memory, bytes memory, bytes32) {
        _readInputs();

        bytes memory updateImplementationData =
            abi.encodeCall(UpgradableProxy.updateImplementation, (newImplementation));
        bytes memory timelockScheduleData = abi.encodeCall(
            TimelockController.schedule,
            (
                proxyAddress, // target
                0, // value
                updateImplementationData, // data
                bytes32(0), // predecessor @todo check the predecessor input
                bytes32(0), // salt
                delay // delay
            )
        );
        bytes memory timelockExecuteData = abi.encodeCall(
            TimelockController.execute,
            (
                proxyAddress, // target
                0, // value
                updateImplementationData, // payload
                bytes32(0), // predecessor
                bytes32(0) // salt
            )
        );
        bytes32 timelockHash = _hashOperation(
            proxyAddress,
            0,
            updateImplementationData,
            bytes32(0), // predecessor
            bytes32(0) // salt
        );

        console.log("************************** CALLDATA START **************************\n");
        console.log("Timelock Schedule Data:", vm.toString(timelockScheduleData));
        console.log("Timelock Execute Data:", vm.toString(timelockExecuteData));
        console.log("Timelock Operation Hash: %s\n", vm.toString(timelockHash));
        console.log("************************** CALLDATA END **************************\n");

        return (timelockScheduleData, timelockExecuteData, timelockHash);
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        newImplementation = vm.parseJsonAddress(inputJson, ".upgradeImplementation.newImplementation");
        proxyAddress = vm.parseJsonAddress(inputJson, ".upgradeImplementation.proxyAddress");
        delay = vm.parseJsonUint(inputJson, ".upgradeImplementation.delay");

        _checkInputs();
    }

    function _checkInputs() internal view {
        require(newImplementation != address(0), "New implementation address cannot be zero");
        require(proxyAddress != address(0), "Proxy address cannot be zero");

        console.log("New Implementation:", newImplementation);
        console.log("Proxy Address:", proxyAddress);
        console.log("Delay: %s\n", vm.toString(delay));
    }

    function _hashOperation(address target, uint256 value, bytes memory data, bytes32 predecessor, bytes32 salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(target, value, data, predecessor, salt));
    }
}
