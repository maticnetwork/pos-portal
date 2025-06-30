// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {UpgradableProxy} from "../../scripts/helpers/interfaces/UpgradableProxy.generated.sol";

/**
 * @title UpdateImplementationPOS
 * @notice This script generates calldata for the `updateImplementation` function of the UpgradableProxy contract.
 */
contract UpdateImplementationPOS is Script {
    string internal input = "scripts/forge/inputs.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal multisig = 0x355b8E02e7F5301E6fac9b7cAc1D6D9c86C0343f;

    address internal newImplementation;
    address internal proxyAddress;
    string internal contractName;
    uint256 internal delay;
    bytes internal updateData;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (address, bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (address, bytes memory) {
        _readInputs();
        if(newImplementation == address(0)) {
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
        string memory inputJson;
        if (isStringInput) {
            inputJson = input;
        } else {
            inputJson = vm.readFile(input);
        }
        proxyAddress = vm.parseJsonAddress(inputJson, ".upgradeImplementationPOS.proxyAddress");
        contractName = vm.parseJsonString(inputJson, ".upgradeImplementationPOS.contractName");
        updateData = vm.parseJsonBytes(inputJson, ".upgradeImplementationPOS.updateData");
        address implementationAddress = vm.parseJsonAddress(inputJson, ".upgradeImplementationPOS.implementationAddress");
        _checkInputs();

        if (implementationAddress != address(0)) {
            console.log("Using provided implementation address:", implementationAddress);
            newImplementation = implementationAddress;
        }
    }

    function _checkInputs() internal view {
        require(proxyAddress != address(0), "Proxy address cannot be zero");
        require(bytes(contractName).length > 0, "Contract name cannot be empty");

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
