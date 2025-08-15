// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "scripts/helpers/interfaces/UpgradableProxy.generated.sol";
import {TimelockController} from "@openzeppelin-v5/governance/TimelockController.sol";

/**
 * @title UpdateImplementationTimelock
 * @notice This script generates calldata for the `updateImplementation` function of the UpgradableProxy contract which is sent via a TimelockController.
 */
contract UpdateImplementationTimelock is Script {
    string internal input;
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal timelockController;
    address internal newImplementation;
    address internal proxyAddress;
    string internal contractName;
    bytes internal updateData;
    uint256 internal delay;
    bytes32 internal salt;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input, string memory _contractName)
        public
        returns (address, bytes memory, bytes memory, bytes32)
    {
        isStringInput = true;
        input = _input;
        contractName = _contractName;
        return run();
    }

    function run() public virtual returns (address, bytes memory, bytes memory, bytes32) {
        _readInputs();
        if (newImplementation == address(0)) {
            console.log("No implementation address provided, deploying a new implementation");
            _deployImplementation();
        }

        bytes memory updateImplementationData;
        if (updateData.length == 0) {
            console.log("No update data provided, using updateImplementation");
            updateImplementationData = abi.encodeCall(UpgradableProxy.updateImplementation, (newImplementation));
        } else {
            console.log("Update data provided, using updateAndCall");
            updateImplementationData = abi.encodeCall(UpgradableProxy.updateAndCall, (newImplementation, updateData));
        }
        bytes memory timelockScheduleData = abi.encodeCall(
            TimelockController.schedule,
            (
                proxyAddress, // target
                0, // value
                updateImplementationData, // data
                bytes32(0), // predecessor
                salt, // salt
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
                salt // salt
            )
        );
        bytes32 timelockHash = _hashOperation(
            proxyAddress,
            0,
            updateImplementationData,
            bytes32(0), // predecessor
            salt // salt
        );

        console.log("Timelock Operation Hash: %s\n", vm.toString(timelockHash));

        console.log("--------------------------------------------------------------------\n");
        console.log("Send to Timelock Controller: %s\n", timelockController);
        console.log("--------------------------------------------------------------------\n");

        console.log("************************** CALLDATA START **************************\n");
        console.log("Timelock Schedule Data: %s\n", vm.toString(timelockScheduleData));
        console.log("Timelock Execute Data: %s\n", vm.toString(timelockExecuteData));
        console.log("************************** CALLDATA END **************************\n");

        return (newImplementation, timelockScheduleData, timelockExecuteData, timelockHash);
    }

    function _readInputs() internal {
        require(bytes(contractName).length > 0, "Contract name must be provided");

        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(string.concat("scripts/forge/update-impl-timelock/", contractName, "/input.json"));
        }
        proxyAddress = vm.parseJsonAddress(inputJson, ".proxyAddress");
        updateData = vm.parseJsonBytes(inputJson, ".updateData");
        delay = vm.parseJsonUint(inputJson, ".delay");
        salt = vm.parseJsonBytes32(inputJson, ".salt");
        timelockController = vm.parseJsonAddress(inputJson, ".timelock");
        address implementationAddress = vm.parseJsonAddress(inputJson, ".implementationAddress");
        _checkInputs();

        if (implementationAddress != address(0)) {
            console.log("Using provided implementation address:", implementationAddress);
        }
        newImplementation = implementationAddress;
    }

    function _checkInputs() internal view {
        require(proxyAddress != address(0), "Proxy address cannot be zero");
        require(bytes(contractName).length > 0, "Contract name cannot be empty");
        require(timelockController != address(0), "Timelock controller cannot be zero");

        console.log("Contract Name:", contractName);
        console.log("Proxy Address:", proxyAddress);
        console.log("Update Data:", vm.toString(updateData));
        console.log("Delay:", vm.toString(delay));
        console.log("Salt:", vm.toString(salt));
    }

    function _deployImplementation() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        string memory contractPath = string.concat("out/", contractName, ".sol/", contractName, ".json");
        newImplementation = deployCode(contractPath);

        console.log("Deployed %s at %s", contractName, newImplementation);

        vm.stopBroadcast();
    }

    function _hashOperation(address _target, uint256 _value, bytes memory _data, bytes32 _predecessor, bytes32 _salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_target, _value, _data, _predecessor, _salt));
    }
}
