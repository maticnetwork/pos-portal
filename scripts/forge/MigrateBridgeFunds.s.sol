// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import "forge-std/Script.sol";
import {RootChainManager} from "../../scripts/helpers/interfaces/RootChainManager.generated.sol";

/**
 * @title MigrateBridgeFunds
 * @notice This script generates calldata for the `migrateBridgeFunds` function of the RootChainManager contract.
 * @dev It supports migrating ERC20, ERC721, ERC1155 tokens, and Ether from the root chain to a specified receiver.
 */
contract MigrateBridgeFunds is Script {
    string internal input = "scripts/forge/inputs.json";
    bool internal isStringInput; // flag used to determine if input is a string or a file path

    address internal rootToken;
    address internal receiver;
    string internal predicateType;
    bool internal isERC20;
    bool internal isERC721;
    bool internal isERC1155;
    bool internal isEther;

    // For ERC20
    uint256 internal erc20Amount;
    // For ERC721
    address internal erc721Predicate;
    uint256 internal erc721TokenId;
    // For ERC1155
    address internal erc1155Predicate;
    uint256[] internal erc1155TokenIds;
    uint256[] internal erc1155Amounts;
    bytes internal erc1155Data;
    // For Ether
    uint256 internal etherAmount;

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
        } else if (isERC721) {
            bytes memory data = abi.encodeWithSignature(
                "transferFrom(address,address,uint256)", erc721Predicate, receiver, erc721TokenId
            );
            output = abi.encodeCall(RootChainManager.migrateBridgeFunds, (rootToken, data));
        } else if (isERC1155) {
            bytes memory data = abi.encodeWithSignature(
                "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
                erc1155Predicate,
                receiver,
                erc1155TokenIds,
                erc1155Amounts,
                erc1155Data
            );
            output = abi.encodeCall(RootChainManager.migrateBridgeFunds, (rootToken, data));
        } else if (isEther) {
            bytes memory data = abi.encode(receiver, etherAmount);
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
        rootToken = vm.parseJsonAddress(inputJson, ".migrateBridgeFunds.rootToken");
        receiver = vm.parseJsonAddress(inputJson, ".migrateBridgeFunds.receiver");
        predicateType = vm.parseJsonString(inputJson, ".migrateBridgeFunds.predicateType");

        bytes32 predicateHash = keccak256(abi.encodePacked(predicateType));
        isERC20 = predicateHash == keccak256("ERC20");
        isERC721 = predicateHash == keccak256("ERC721");
        isERC1155 = predicateHash == keccak256("ERC1155");
        isEther = predicateHash == keccak256("Ether");

        if (!isERC20 && !isERC721 && !isERC1155 && !isEther) {
            revert("Unsupported predicate type provided in input");
        }

        if (isERC20) {
            erc20Amount = vm.parseJsonUint(inputJson, ".migrateBridgeFunds.erc20.amount");
        } else if (isERC721) {
            erc721Predicate = vm.parseJsonAddress(inputJson, ".migrateBridgeFunds.erc721.erc721Predicate");
            erc721TokenId = vm.parseJsonUint(inputJson, ".migrateBridgeFunds.erc721.tokenId");
        } else if (isERC1155) {
            erc1155Predicate = vm.parseJsonAddress(inputJson, ".migrateBridgeFunds.erc1155.erc1155Predicate");
            erc1155TokenIds = vm.parseJsonUintArray(inputJson, ".migrateBridgeFunds.erc1155.tokenIds");
            erc1155Amounts = vm.parseJsonUintArray(inputJson, ".migrateBridgeFunds.erc1155.amounts");
            erc1155Data = vm.parseJsonBytes(inputJson, ".migrateBridgeFunds.erc1155.data");
        } else if (isEther) {
            etherAmount = vm.parseJsonUint(inputJson, ".migrateBridgeFunds.ether.amount");
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
        } else if (isERC721) {
            require(erc721Predicate != address(0), "ERC721 predicate address cannot be zero");
            console.log("ERC721 Token ID: %s\n", vm.toString(erc721TokenId));
        } else if (isERC1155) {
            require(erc1155Predicate != address(0), "ERC1155 predicate address cannot be zero");
            require(
                erc1155TokenIds.length > 0 && erc1155Amounts.length > 0
                    && erc1155TokenIds.length == erc1155Amounts.length,
                "ERC1155 token IDs and amounts cannot be empty or mismatched"
            );
            for (uint256 i = 0; i < erc1155Amounts.length; i++) {
                require(erc1155Amounts[i] > 0, "ERC1155 amount must be greater than zero");
            }
            console.log("ERC1155 Token IDs:");
            for (uint256 i = 0; i < erc1155TokenIds.length; i++) {
                console.log("%s", vm.toString(erc1155TokenIds[i]));
            }
            console.log("ERC1155 Amounts:");
            for (uint256 i = 0; i < erc1155Amounts.length; i++) {
                console.log("%s", vm.toString(erc1155Amounts[i]));
            }
            console.log("ERC1155 Data: %s\n", vm.toString(erc1155Data));
        } else if (isEther) {
            require(etherAmount > 0, "Ether amount must be greater than zero");
            console.log("Ether Amount: %s\n", vm.toString(etherAmount));
        }
    }
}
