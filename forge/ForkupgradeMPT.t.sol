pragma solidity ^0.8.4;

import {RootChainManagerProxy} from "../scripts/helpers/interfaces/RootChainManagerProxy.generated.sol";
import {RootChainManager} from "../scripts/helpers/interfaces/RootChainManager.generated.sol";

import {ExitPayloadReader} from "./ExitPayloadReader.sol";
import {MerklePatriciaProof} from "./MerklePatriciaProof.sol";

import "forge-std/Test.sol";

struct TxObject {
    address from;
    bytes32 hash;
    bytes input;
    bool isError;
    bytes mod_input;
    bool txreceipt_status;
}

struct FileObject {
    TxObject[] txObjects;
}

contract ForkupgradeMPT is Test {
    using stdJson for string;

    uint256 mainnetFork;
    address rootChainManagerProxy = 0xA0c68C638235ee32657e8f720a23ceC1bFc77C77;
    address timelock = 0xCaf0aa768A3AE1297DF20072419Db8Bb8b5C8cEf;

    bytes32 notOwner721Error = keccak256(hex"08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000294552433732313a207472616e73666572206f6620746f6b656e2074686174206973206e6f74206f776e0000000000000000000000000000000000000000000000");
    bytes32 notOwnerNorApproved721Error = keccak256(hex"08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000314552433732313a207472616e736665722063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564000000000000000000000000000000");
    bytes32 outOfBalance20Error = keccak256(hex"08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a205472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000");
    bytes32 exceedsBalance20Error = keccak256(hex"08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000");
    bytes32 safeERC20lowlevelError = keccak256(hex"08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000205361666545524332303a206c6f772d6c6576656c2063616c6c206661696c6564");
 
    function setUp() public {                             
        mainnetFork = vm.createFork(vm.rpcUrl("mainnet"), 20910000);
        vm.selectFork(mainnetFork);
    }

    function test_UpgradeMPTSkipCI() public {
        assertEq(vm.activeFork(), mainnetFork);
        
        address rootChainManagerImpl = deployCode("out/RootChainManager.sol/RootChainManager.json");
       
        vm.prank(address(timelock));
        RootChainManagerProxy(payable(rootChainManagerProxy)).updateImplementation(rootChainManagerImpl);
        
        // load tx to be replayed
        string memory txsJson = vm.readFile("forge/batchExit.json");
        bytes memory txs = vm.parseJson(txsJson);
        FileObject memory txBatch1 = abi.decode(txs, (FileObject));
        uint256 successes = 0;
        uint256 successesButError = 0;
        uint256 intentionalError = 0;

            // loop
        for (uint i = 0; i < txBatch1.txObjects.length; i++) {
        //for (uint i = 13; i < 15; i++) {
            console.log("tx num: ", i);
            TxObject memory obj = txBatch1.txObjects[i];
            console.log("from: ", obj.from);
            console.log("hash:");
            console.logBytes32(obj.hash);
            // Get the index of the exit
            bytes32 index = calcExitHash(obj.mod_input);
            console.logBytes32(index);

            // Calculate the storage slots we need to manipulate to replay the tx
            bytes32 slotprocessedExits = keccak256(abi.encode(index, 6));
           
            // RootChainManager
            vm.store(rootChainManagerProxy, slotprocessedExits, 0);
           
            // Pretend to be the the exitor and replay tx
            vm.prank(obj.from);
            (bool successSchedule, bytes memory dataSchedule) = rootChainManagerProxy.call(obj.input);
            if (successSchedule == false) {        
                if(obj.isError) {
                    console.log("successful failure");
                    intentionalError += 1;
                    continue;
                }
                if(keccak256(dataSchedule) == notOwner721Error) {
                    console.log("Not owner error");
                    successesButError += 1;
                    continue;
                }
                if(keccak256(dataSchedule) == notOwnerNorApproved721Error) {
                    console.log("Not owner error");
                    successesButError += 1;
                    continue;
                }
                if(keccak256(dataSchedule) == outOfBalance20Error) {
                    console.log("Not enough balance error");
                    successesButError += 1;
                    continue;
                }
                if(keccak256(dataSchedule) == exceedsBalance20Error) {
                    console.log("Exceeds balance error");
                    successesButError += 1;
                    continue;
                }
                if(keccak256(dataSchedule) == safeERC20lowlevelError){
                    console.log("Safe ERC20 low level fail");
                    successesButError += 1;
                    continue;
                }
                
                console.log("actual error");
                console.logBytes(dataSchedule);
                assembly {
                    revert(add(dataSchedule, 32), mload(dataSchedule))
                }
            } else {
                successes += 1;
                console.log("success");
            }
        }
        console.log("Total successful tx: ", successes);
        console.log("Total successful MPT but error tx: ", successesButError);
        console.log("Total intentional error tx: ", intentionalError);

    }

    // taken from RootChainManager
    function calcExitHash(bytes memory input) internal pure returns (bytes32) {
        ExitPayloadReader.ExitPayload memory payload = ExitPayloadReader.toExitPayload(input);

        bytes memory branchMaskBytes = ExitPayloadReader.getBranchMaskAsBytes(payload);
        // checking if exit has already been processed
        // unique exit is identified using hash of (blockNumber, branchMask, receiptLogIndex)
        bytes32 exitHash = keccak256(
            abi.encodePacked(
                ExitPayloadReader.getBlockNumber(payload),
                // first 2 nibbles are dropped while generating nibble array
                // this allows branch masks that are valid but bypass exitHash check (changing first 2 nibbles only)
                // so converting to nibble array and then hashing it
                MerklePatriciaProof._getNibbleArray(branchMaskBytes),
                ExitPayloadReader.getReceiptLogIndex(payload)
            )
        );
        return exitHash;
    }
}
