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

    address internal timelockController = 0xCaf0aa768A3AE1297DF20072419Db8Bb8b5C8cEf;

    address internal newImplementation;
    address internal proxyAddress;
    string internal contractName;
    uint256 internal delay;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (address, bytes memory, bytes memory, bytes32) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (address, bytes memory, bytes memory, bytes32) {
        _readInputs();
        _deployImplementation();

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

        console.log("Timelock Operation Hash:", vm.toString(timelockHash));
        console.log("Send to Timelock Controller: %s\n", timelockController);
        console.log("************************** CALLDATA START **************************\n");
        console.log("Timelock Schedule Data: %s\n", vm.toString(timelockScheduleData));
        console.log("Timelock Execute Data: %s\n", vm.toString(timelockExecuteData));
        console.log("************************** CALLDATA END **************************\n");

        return (newImplementation, timelockScheduleData, timelockExecuteData, timelockHash);
    }

    function _readInputs() internal {
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        proxyAddress = vm.parseJsonAddress(inputJson, ".upgradeImplementation.proxyAddress");
        contractName = vm.parseJsonString(inputJson, ".upgradeImplementation.contractName");
        delay = vm.parseJsonUint(inputJson, ".upgradeImplementation.delay");

        _checkInputs();
    }

    function _checkInputs() internal view {
        require(proxyAddress != address(0), "Proxy address cannot be zero");
        require(bytes(contractName).length > 0, "Contract name cannot be empty");

        console.log("Proxy Address:", proxyAddress);
        console.log("Delay:", vm.toString(delay));
    }

    function _deployImplementation() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        string memory contractPath = string.concat("out/", contractName, ".sol/", contractName, ".json");
        newImplementation = deployCode(contractPath);

        console.log("Deployed %s at %s", contractName, newImplementation);

        vm.stopBroadcast();
    }

    function _hashOperation(address target, uint256 value, bytes memory data, bytes32 predecessor, bytes32 salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(target, value, data, predecessor, salt));
    }
}
