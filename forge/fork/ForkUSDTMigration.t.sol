// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "forge-std/Test.sol";

import {ERC20Predicate} from "../../scripts/helpers/interfaces/ERC20Predicate.generated.sol";
import {Enum} from "safe-smart-account/libraries/Enum.sol";
import {MigrateBridgeFunds} from "../../scripts/forge/MigrateBridgeFunds.s.sol";
import {RootChainManager} from "../../scripts/helpers/interfaces/RootChainManager.generated.sol";
import {Safe} from "safe-smart-account/Safe.sol";
import {UpdateImplementation} from "../../scripts/forge/UpdateImplementation.s.sol";
import {UpdateTokenStoppageStatus} from "../../scripts/forge/UpdateTokenStoppageStatus.s.sol";
import {IERC20} from "../../scripts/helpers/interfaces/IERC20.generated.sol";

contract ForkUSDTMigration is Test {
    // constants
    bytes32 constant PREDICATE_ERC20 = keccak256("ERC20");

    address internal destination = makeAddr("Destination");

    address internal childUSDT = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
    address internal multisigOwner1 = 0xA7499Aa6464c078EeB940da2fc95C6aCd010c3Cc;
    address internal rootChainManagerProxyOwner = 0xCaf0aa768A3AE1297DF20072419Db8Bb8b5C8cEf;
    address internal timelockController = 0xCaf0aa768A3AE1297DF20072419Db8Bb8b5C8cEf;

    IERC20 internal usdt = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    ERC20Predicate internal erc20PredicateProxy = ERC20Predicate(0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf);
    RootChainManager internal rootChainManagerProxy =
        RootChainManager(payable(0xA0c68C638235ee32657e8f720a23ceC1bFc77C77));
    Safe internal safeMultisig = Safe(payable(0xFa7D2a996aC6350f4b56C043112Da0366a59b74c));

    MigrateBridgeFunds internal migrateBridgeFundsScript;
    UpdateImplementation internal updateImplementationScript;
    UpdateTokenStoppageStatus internal updateTokenStoppageStatusScript;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("mainnet"), 22670312);
        updateImplementationScript = new UpdateImplementation();
        updateTokenStoppageStatusScript = new UpdateTokenStoppageStatus();
        migrateBridgeFundsScript = new MigrateBridgeFunds();

        // Update the RootChainManager implementation
        address newRootChainManagerImpl =
            _deployImplementationCode("contracts/root/RootChainManager/RootChainManager.sol", "RootChainManager");
        string memory input = _getUpdateImplInputs(newRootChainManagerImpl, address(rootChainManagerProxy), 0);
        (bytes memory timelockScheduleData, bytes memory timelockExecuteData,) = updateImplementationScript.run(input);
        _executeViaSafe(timelockScheduleData, timelockExecuteData);
        _verifyNewImplementation(newRootChainManagerImpl, address(rootChainManagerProxy));

        // Update the ERC20Predicate implementation
        address newErc20PredicateImpl =
            _deployImplementationCode("contracts/root/TokenPredicates/ERC20Predicate.sol", "ERC20Predicate");
        input = _getUpdateImplInputs(newErc20PredicateImpl, address(erc20PredicateProxy), 0);
        (timelockScheduleData, timelockExecuteData,) = updateImplementationScript.run(input);
        _executeViaSafe(timelockScheduleData, timelockExecuteData);
        _verifyNewImplementation(newErc20PredicateImpl, address(erc20PredicateProxy));

        // Label the contracts for easier debugging
        vm.label(address(childUSDT), "ChildUSDT");
        vm.label(address(erc20PredicateProxy), "ERC20Predicate Proxy");
        vm.label(address(rootChainManagerProxy), "RootChainManager Proxy");
        vm.label(address(usdt), "USDT");
    }

    function test_setup() public view {
        assertEq(rootChainManagerProxy.rootToChildToken(address(usdt)), childUSDT);
        assertEq(erc20PredicateProxy.TOKEN_TYPE(), PREDICATE_ERC20);
    }

    function test_deposit_disabled() public {
        // Disable USDT deposit
        string memory input = _getUpdateTokenStoppageStatusInputs(address(usdt), true, false, 0);
        bytes memory callData = updateTokenStoppageStatusScript.run(input);
        vm.prank(address(safeMultisig));
        (bool success,) = address(rootChainManagerProxy).call(callData); // Making sure the calldata is correct
        assertTrue(success, "Failed to disable USDT deposit");

        // Try to deposit USDT
        deal(address(usdt), address(this), 10 * 10 ** 6);
        vm.expectRevert("RootChainManager: DEPOSIT_DISABLED");
        rootChainManagerProxy.depositFor(address(this), address(usdt), bytes(""));
    }

    function test_exit_disabled() public {
        // Disable USDT exit
        string memory input = _getUpdateTokenStoppageStatusInputs(address(usdt), false, true, 104); // Last exit block number is set to 104 for hardcoded data
        bytes memory callData = updateTokenStoppageStatusScript.run(input);
        vm.prank(address(safeMultisig));
        (bool success,) = address(rootChainManagerProxy).call(callData); // Making sure the calldata is correct
        assertTrue(success, "Failed to disable USDT exit");

        address tempChildUSDT = address(0x0165878A594ca255338adfa4d48449f69242Eb8F);
        vm.prank(address(safeMultisig));
        rootChainManagerProxy.remapToken(address(usdt), tempChildUSDT, PREDICATE_ERC20); // Bypass the TOKEN_NOT_MAPPED error by remapping the token to the hardcoded child ERC20 address

        // Hardcoded input data with correct format
        bytes memory inputData =
            hex"f903b3018067846849be10a0b1975234de3e3a8a6cd65ab942b798cabf125e622138e9606cf1e820dfa31c93a0bdbe19d8171d28fc381be0f626714c395a48d3d3acd31d2b68797429e2a06dfbb901aaf901a7018250b8b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000008000000000000000000000000000000000000000000000000020000000000000100000800000000000000000000000010000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000200000000000000000000000002000000000000000000020000000000000000000000000000000000000000000000000000000000000000000f89ef89c940165878a594ca255338adfa4d48449f69242eb8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266a00000000000000000000000000000000000000000000000000000000000000000a101f2d8ffbe32fde7d0d77e865256c247af0826af2644fad762ad70b92654073f68b901b5f901b2f901af822080b901a9f901a6018250b8b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000008000000000000000000000000000000000000000000000000020000000000000100000800000000000000000000000010000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000200000000000000000000000002000000000000000000020000000000000000000000000000000000000000000000000000000000000000000f89df89b940165878a594ca255338adfa4d48449f69242eb8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266a00000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000002c68af0bb14000082008080";

        // Try to exit USDT
        vm.expectRevert("RootChainManager: EXIT_DISABLED");
        rootChainManagerProxy.exit(inputData);
    }

    function test_usdtMigration() public {
        uint256 usdtPredicateBalanceBefore = usdt.balanceOf(address(erc20PredicateProxy));
        assertGt(usdtPredicateBalanceBefore, 0);

        uint256 usdtDecimals = 6;
        uint256 integerPart = usdtPredicateBalanceBefore / 10 ** usdtDecimals;
        uint256 fractionalPart = usdtPredicateBalanceBefore % 10 ** usdtDecimals;
        string memory integerPartWithCommas = _addCommas(integerPart);
        string memory fractionalStr = _padFractional(fractionalPart, usdtDecimals);
        emit log_named_string(
            "USDT Predicate Balance Before", string(abi.encodePacked("$", integerPartWithCommas, ".", fractionalStr))
        );

        string memory input = _getMigrateBridgeFundsInputs(address(usdt), destination, usdtPredicateBalanceBefore);

        bytes memory callData = migrateBridgeFundsScript.run(input);
        vm.prank(address(safeMultisig));
        (bool success,) = address(rootChainManagerProxy).call(callData); // Making sure the calldata is correct
        assertTrue(success, "Failed to migrate USDT");

        assertEq(
            usdt.balanceOf(address(erc20PredicateProxy)), 0, "USDT Predicate balance should be zero after migration"
        );
        assertEq(
            usdt.balanceOf(destination),
            usdtPredicateBalanceBefore,
            "USDT Receiver balance should be equal to the predicate balance before migration"
        );
    }

    // Helper to add commas to integer part
    function _addCommas(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bytes memory str = bytes(vm.toString(value));
        uint256 len = str.length;
        uint256 commas = (len - 1) / 3;
        bytes memory result = new bytes(len + commas);
        uint256 j = result.length;
        uint256 k = 0;
        for (uint256 i = len; i > 0; i--) {
            result[--j] = str[i - 1];
            k++;
            if (k % 3 == 0 && i != 1) {
                result[--j] = ",";
            }
        }
        return string(result);
    }

    // Helper to pad fractional part with leading zeros
    function _padFractional(uint256 value, uint256 decimals) internal pure returns (string memory) {
        bytes memory str = bytes(vm.toString(value));
        uint256 len = str.length;
        if (len >= decimals) return string(str);
        bytes memory result = new bytes(decimals);
        uint256 pad = decimals - len;
        for (uint256 i = 0; i < pad; i++) {
            result[i] = "0";
        }
        for (uint256 i = 0; i < len; i++) {
            result[pad + i] = str[i];
        }
        return string(result);
    }

    // Helper to write the inputs for the update implementation script
    function _getUpdateImplInputs(address newImplementation, address proxyAddress, uint256 delay)
        internal
        returns (string memory)
    {
        string memory obj1 = "UIObject";
        string memory obj2 = "UIValueObject";
        vm.serializeAddress(obj2, "newImplementation", newImplementation);
        vm.serializeAddress(obj2, "proxyAddress", proxyAddress);
        string memory output = vm.serializeUint(obj2, "delay", delay);
        return vm.serializeString(obj1, "upgradeImplementation", output);
    }

    // Helper to write the inputs for the update token stoppage status script
    function _getUpdateTokenStoppageStatusInputs(
        address rootToken,
        bool isDepositDisabled,
        bool isExitDisabled,
        uint256 lastExitBlockNumber
    ) internal returns (string memory) {
        string memory obj1 = "UTSSObject";
        string memory obj2 = "UTSSValueObject";
        vm.serializeAddress(obj2, "rootToken", rootToken);
        vm.serializeBool(obj2, "isDepositDisabled", isDepositDisabled);
        vm.serializeBool(obj2, "isExitDisabled", isExitDisabled);
        string memory output = vm.serializeUint(obj2, "lastExitBlockNumber", lastExitBlockNumber);
        return vm.serializeString(obj1, "updateTokenStoppageStatus", output);
    }

    // Helper to write the inputs for the migrate bridge funds script
    function _getMigrateBridgeFundsInputs(address rootToken, address receiver, uint256 amount)
        internal
        returns (string memory)
    {
        string memory obj1 = "MBFObject";
        string memory obj2 = "MBFValueObject";
        string memory obj3 = "ERC20ValueObject";
        vm.serializeAddress(obj2, "rootToken", rootToken);
        vm.serializeAddress(obj2, "receiver", receiver);
        vm.serializeString(obj2, "predicateType", "ERC20");
        string memory output1 = vm.serializeUint(obj3, "amount", amount);
        string memory output2 = vm.serializeString(obj2, "erc20", output1);
        return vm.serializeString(obj1, "migrateBridgeFunds", output2);
    }

    // Helper to deploy new implementation code for a given contract
    function _deployImplementationCode(string memory contractPath, string memory contractName)
        internal
        returns (address)
    {
        string[] memory cmd = new string[](4);
        cmd[0] = "forge";
        cmd[1] = "inspect";
        cmd[2] = string(abi.encodePacked(contractPath, ":", contractName));
        cmd[3] = "deployedBytecode";
        bytes memory bytecode = vm.ffi(cmd);
        address newImplementation = makeAddr(string(abi.encodePacked(contractName, " New Implementation")));
        vm.etch(newImplementation, bytecode);
        return newImplementation;
    }

    // Helper to verify the new implementation address
    function _verifyNewImplementation(address expectedImplementation, address proxyAddress) internal {
        (, bytes memory returnData) = proxyAddress.call(abi.encodeWithSignature("implementation()"));
        address actualImplementation = abi.decode(returnData, (address));
        assertEq(actualImplementation, expectedImplementation, "New implementation address mismatch");
    }

    // Helper to schedule and execute the timelock via the Safe account
    function _executeViaSafe(bytes memory timelockScheduleData, bytes memory timelockExecuteData) internal {
        vm.prank(address(safeMultisig));
        safeMultisig.changeThreshold(1); // set threshold to 1 for easy execution

        bytes32 operationHash = safeMultisig.getTransactionHash(
            timelockController,
            0, // value
            timelockScheduleData,
            Enum.Operation.Call,
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            0x0000000000000000000000000000000000000000, // gasToken
            payable(0x0000000000000000000000000000000000000000),
            0
        );

        vm.startPrank(multisigOwner1);

        safeMultisig.approveHash(operationHash);

        bytes memory signature =
            abi.encodePacked(abi.encodePacked(bytes32(uint256(uint160(multisigOwner1))), bytes32(0), uint8(1)));

        safeMultisig.execTransaction(
            timelockController,
            0,
            timelockScheduleData,
            Enum.Operation.Call,
            3_000_000, // safeTxGas
            0, // baseGas
            3_000_000, // gasPrice
            0x0000000000000000000000000000000000000000, // gasToken
            payable(0x0000000000000000000000000000000000000000), // refundReceiver
            signature // signatures
        );

        safeMultisig.execTransaction(
            timelockController,
            0,
            timelockExecuteData,
            Enum.Operation.Call,
            3_000_000, // safeTxGas
            0, // baseGas
            3_000_000, // gasPrice
            0x0000000000000000000000000000000000000000, // gasToken
            payable(0x0000000000000000000000000000000000000000), // refundReceiver
            signature // signatures
        );

        vm.stopPrank();
    }
}
