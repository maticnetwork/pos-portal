// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "scripts/helpers/interfaces/UpgradableProxy.generated.sol";

/**
 * @title UpdateImplementationMultisig
 * @notice This script generates calldata for the `updateImplementation` or the `updateAndCall` function of the UpgradableProxy contract which is sent via the multisig.
 */
contract UpdateImplementationMultisig is Script {
    string internal input;
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal newImplementation;
    address internal proxyAddress;
    string internal contractName;
    bytes internal updateData;
    uint256 internal delay;
    address internal multisig;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input, string memory _contractName) public returns (address, bytes memory) {
        isStringInput = true;
        input = _input;
        contractName = _contractName;
        return run();
    }

    function run() public virtual returns (address, bytes memory) {
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

        console.log("--------------------------------------------------------------------\n");
        console.log("Send to Multisig: %s\n", multisig);
        console.log("--------------------------------------------------------------------\n");

        console.log("************************** CALLDATA START **************************\n");
        console.log("%s\n", vm.toString(updateImplementationData));
        console.log("************************** CALLDATA END **************************\n");

        return (newImplementation, updateImplementationData);
    }

    function _readInputs() internal {
        require(bytes(contractName).length > 0, "Contract name must be provided");

        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(string.concat("scripts/forge/update-impl-multisig/", contractName, "/input.json"));
        }
        proxyAddress = vm.parseJsonAddress(inputJson, ".proxyAddress");
        updateData = vm.parseJsonBytes(inputJson, ".updateData");
        multisig = vm.parseJsonAddress(inputJson, ".multisig");
        address implementationAddress = vm.parseJsonAddress(inputJson, ".implementationAddress");
        _checkInputs();

        if (implementationAddress != address(0)) {
            console.log("Using provided implementation address:", implementationAddress);
            newImplementation = implementationAddress;
        }
    }

    function _checkInputs() internal view {
        require(proxyAddress != address(0), "Proxy address cannot be zero");
        require(bytes(contractName).length > 0, "Contract name cannot be empty");
        require(multisig != address(0), "Multisig address cannot be zero");

        console.log("Contract Name:", contractName);
        console.log("Proxy Address:", proxyAddress);
        console.log("Update Data:", vm.toString(updateData));
    }

    function _deployImplementation() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        string memory contractPath = string.concat("out/", contractName, ".sol/", contractName, ".json");
        newImplementation = deployCode(contractPath);

        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Deployed %s at %s:", contractName, newImplementation);

        vm.stopBroadcast();
    }
}
