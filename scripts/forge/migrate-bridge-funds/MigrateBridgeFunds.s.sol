// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {RootChainManager} from "scripts/helpers/interfaces/RootChainManager.generated.sol";

/**
 * @title MigrateBridgeFunds
 * @notice This script generates calldata for the `migrateBridgeFunds` function of the RootChainManager contract.
 * @dev It supports migrating ERC20 from the root chain to a specified receiver.
 */
contract MigrateBridgeFunds is Script {
    string internal input = "scripts/forge/migrate-bridge-funds/input.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal rootToken;
    address internal receiver;
    string internal predicateType;
    bool internal isERC20;

    // For ERC20
    uint256 internal erc20Amount;

    // Helper function to run the script with a string input helpful for testing
    function run(string memory _input) public returns (bytes memory) {
        isStringInput = true;
        input = _input;
        return run();
    }

    function run() public returns (bytes memory) {
        _readInputs();

        bytes memory output;
        if (isERC20) {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", receiver, erc20Amount);
            output = abi.encodeCall(RootChainManager.migrateBridgeFunds, (rootToken, data));
        }

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
        rootToken = vm.parseJsonAddress(inputJson, ".rootToken");
        receiver = vm.parseJsonAddress(inputJson, ".receiver");
        predicateType = vm.parseJsonString(inputJson, ".predicateType");

        bytes32 predicateHash = keccak256(abi.encodePacked(predicateType));
        isERC20 = predicateHash == keccak256("ERC20");

        if (!isERC20) {
            revert("Unsupported predicate type provided in input");
        }

        if (isERC20) {
            erc20Amount = vm.parseJsonUint(inputJson, ".erc20.amount");
        }
        _checkInputs();
    }

    function _checkInputs() internal view {
        require(rootToken != address(0), "Root token address cannot be zero");
        require(receiver != address(0), "Receiver address cannot be zero");
        require(bytes(predicateType).length > 0, "Predicate type cannot be empty");

        console.log("Generating calldata for migrateBridgeFunds ...");
        console.log("Root Token: %s", rootToken);
        console.log("Receiver: %s", receiver);
        console.log("Predicate Type: %s", predicateType);
        if (isERC20) {
            require(erc20Amount > 0, "ERC20 amount must be greater than zero");
            console.log("ERC20 Amount: %s\n", vm.toString(erc20Amount));
        }
    }
}
