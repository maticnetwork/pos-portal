// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "forge-std/Test.sol";

import {ERC20Predicate} from "../../scripts/helpers/interfaces/ERC20Predicate.generated.sol";
import {Enum} from "safe-smart-account/libraries/Enum.sol";
import {GrantRole} from "../../scripts/forge/GrantRole.s.sol";
import {MigrateBridgeFunds} from "../../scripts/forge/MigrateBridgeFunds.s.sol";
import {RootChainManager} from "../../scripts/helpers/interfaces/RootChainManager.generated.sol";
import {Safe} from "safe-smart-account/Safe.sol";
import {UpdateImplementation} from "../../scripts/forge/UpdateImplementation.s.sol";
import {UpdateTokenMigrationStatus} from "../../scripts/forge/UpdateTokenMigrationStatus.s.sol";
import {IERC20} from "../../scripts/helpers/interfaces/IERC20.generated.sol";

contract ForkUSDTMigration is Test {
    // constants
    bytes32 constant PREDICATE_ERC20 = keccak256("ERC20");
    bytes32 constant MIGRATION_MANAGER_ROLE = keccak256("MIGRATION_MANAGER_ROLE");

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

    GrantRole internal grantRoleScript;
    MigrateBridgeFunds internal migrateBridgeFundsScript;
    UpdateImplementation internal updateImplementationScript;
    UpdateTokenMigrationStatus internal updateTokenMigrationStatusScript;

    function setUp() public {
        Account memory deployer = makeAccount("Deployer");
        vm.setEnv("PRIVATE_KEY", vm.toString(deployer.key));
        vm.createSelectFork(vm.rpcUrl("mainnet"), 22670312);
        updateImplementationScript = new UpdateImplementation();
        updateTokenMigrationStatusScript = new UpdateTokenMigrationStatus();
        migrateBridgeFundsScript = new MigrateBridgeFunds();
        grantRoleScript = new GrantRole();

        // Update the RootChainManager implementation
        string memory grantRoleInput = _getGrantRoleInputs("MIGRATION_MANAGER_ROLE", address(safeMultisig));
        bytes memory updateData = grantRoleScript.run(grantRoleInput);
        string memory input = _getUpdateImplInputs("RootChainManager", address(rootChainManagerProxy), updateData, 0);
        (address newImpl, bytes memory timelockScheduleData, bytes memory timelockExecuteData,) =
            updateImplementationScript.run(input);
        _executeViaSafe(timelockScheduleData, timelockExecuteData);
        _verifyNewImplementation(newImpl, address(rootChainManagerProxy));

        // Update the ERC20Predicate implementation
        input = _getUpdateImplInputs("ERC20Predicate", address(erc20PredicateProxy), bytes(""), 0);
        (newImpl, timelockScheduleData, timelockExecuteData,) = updateImplementationScript.run(input);
        _executeViaSafe(timelockScheduleData, timelockExecuteData);
        _verifyNewImplementation(newImpl, address(erc20PredicateProxy));

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
        string memory input = _getUpdateTokenMigrationStatusInputs(address(usdt), true, false, 0);
        bytes memory callData = updateTokenMigrationStatusScript.run(input);
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
        uint256 hardcodedLastExitBlockNumber = 103; // Hardcoded value in the input data for testing
        string memory input =
            _getUpdateTokenMigrationStatusInputs(address(usdt), false, true, hardcodedLastExitBlockNumber - 1); // Last exit block number is set to 103 for hardcoded data so we set the last exit block number to one less than that
        bytes memory callData = updateTokenMigrationStatusScript.run(input);
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

    function test_old_exits_enabled() public {
        uint256 hardcodedLastExitBlockNumber = 53973586;
        string memory input =
            _getUpdateTokenMigrationStatusInputs(address(usdt), false, true, hardcodedLastExitBlockNumber + 1); // Set the last exit block number to one more than the hardcoded value in the input data
        bytes memory callData = updateTokenMigrationStatusScript.run(input);
        vm.prank(address(safeMultisig));
        (bool success,) = address(rootChainManagerProxy).call(callData);
        assertTrue(success, "Failed to enable USDT exit");

        // The input data is an old transaction that is supposed to be processed before the migration
        // {
        //   "_id": "66b2b047883beea4761c01a1",
        //   "transactionIndex": 46,
        //   "sourceNetwork": -1,
        //   "destinationNetwork": 0,
        //   "blockNumber": 53973586,
        //   "amounts": [
        //     "0x15d16a" // 1429866
        //   ],
        //   "bridgeType": "POS",
        //   "dataType": "ERC20",
        //   "isDecoded": false,
        //   "status": "READY_TO_CLAIM",
        //   "timestamp": "2024-02-26T08:56:42.000Z",
        //   "tokenIds": [],
        //   "transactionHash": "0xa3028e5302f79b3f68d50fb9b4039883a7873e0aa1183082e65dabd6d0c63d7b",
        //   "userAddress": "0xb41536a682cee65205eeb94d174dd92c8b19a98c",
        //   "wrappedTokenAddress": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        //   "wrappedTokenNetwork": -1
        // }
        // See: https://polygonscan.com/tx/0xa3028e5302f79b3f68d50fb9b4039883a7873e0aa1183082e65dabd6d0c63d7b
        bytes memory inputData =
            hex"f90aa78422d849c0b9016013a935e7b4db9e540b267274c2ec1247aa8c10ae2ca0e8dc98617a0d14caa5832f20083c536e93f9a00dce533994b23e7e5da5870d12c9587f31a3415061781046e1283371bd84a828aa3d8619b6111017cabe13dc41c922b71b9f791f1dc0f062dbb1a58fb98d801ef5acd12660e8bbe34cb3dc8766255544a374b03d222aae3dae7c8f1a04e51dec0c25fd645c2afbf852db95bbb567a237eb00695c0f06f3923cb37de89589f899c8ab9dd84bcabeb5a3af5437dde8e50075a38843aed67b940d8745d2ed32549557232b7e0cce403b3f703e20ac3d6d2bc6323139f5e174fe78e0ef0ac815fb6e2fbdbd34fe493881a722aef3d3b98825e7e13a8332c0939867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756afcefad4e508c098b9a7e1d8feb19955fb02ba9675585078710969d3440f5054e01f99e6490e8a985c215d93fbf4b209fb687535d2e017a5ddb75ae4fd1b05681984033792528465dc524aa0ea2ba8b08c27d252f39ff6f2250c8ab9c8fd1e275049f4728996cb4b85f9c4f2a01fe3c0ad5e09350403e93af224cd9b8a806aa98ec14ff0342344f3f82e0f2e5eb902ec02f902e801838609d6b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100008000000000000000000000000004000000000000000000000008000000800000000000000000000100000000000000000000020000000000000000000800000000000100000080000010000000000000004000080000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000020000080004000000002000000000001000000010000400000000000000000100000000020000000000000000000000000000000000000000000000000000000000000100000f901ddf89b94c2132d05d31c914a87c6611c10748aeb04b58e8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b41536a682cee65205eeb94d174dd92c8b19a98ca00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000015d16af9013d940000000000000000000000000000000000001010f884a04dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63a00000000000000000000000000000000000000000000000000000000000001010a0000000000000000000000000b41536a682cee65205eeb94d174dd92c8b19a98ca0000000000000000000000000eedba2484aaf940f37cd3cd21a5d7c4a7dafbfc0b8a0000000000000000000000000000000000000000000000000000440890f7050080000000000000000000000000000000000000000000000006434dcb8705b6daa00000000000000000000000000000000000000000000f8458e6b1a052a28d53b00000000000000000000000000000000000000000000000064309c2f60eb1da200000000000000000000000000000000000000000000f8458e6f5a8e39992543b905fdf905faf8f1a074314e0ad9d775e618cdf09e7bd001493960ef3ba68171013a1d9dce065be0a2a0ad0a88e0ed92f61f0afe1aaa23475c3517f9b3e730e1fd1430ae14c33896e100a07eb53efcb17e5e493c4f483286340681b8dd4fb7beca304781576a00b8f39e7fa0d8895114a92ebbf4d29c6ef69c3e2b3e04a22b4647651bc9ceb902b43ff0812ba0871fcf23dbe96b581e28c3d29eeaece73d8e8458d700d5f0371aa13b73873e45a0f8fb130d92f707ebee92d68fbb4d8b5bf952250fb27cdb1ece9c658fc2e4d1c88080a01a45b9ad6a40bd29ccc890022007f5a8765268f757c6686d476a9d430d87666d8080808080808080f90211a00a22472aa8deec326c1ac48fa88252ea5d03f8bae987af74b40b6b05526e5caaa0bc05c0264b42eb0dc88615479ae62cd034f110a47fe880e97a0cefe6c87db683a08c6d6516c5b3dbb586d3b272b9bf7f059170fc09a5dff7e5545bc5553ec14bb1a009a1ab3fcb2578538edd76da784a950da04cd2767366da43da0e7565aba8f90ba0ee8209dbc84dec299ede6df5dca437462de741869c6f1fdf2bcfdf39eb7fe21da039f48c1e7614c2c63620a97875bc3d766b41e4df6d0792829c9d00e96bbf3ea2a0d724b0c415f3a04d524de84ac7b3782b0d085b099675dcba3510a24037b9ba48a003b2f3e98fc8a67d05d95123a0c9e00ce54b7f3ed2dc22417c3eb950179e1597a02bfa3e067b60b0618027afc125d1d136c2a9a540925fb6b4587c25010d7bd5bfa090464cb7a4e0d987fd01fc98945def1c43128c5f61042788e64b734d6d835134a0b0b5cc9499dd64ee2b0ddb2c5cfb4aeac40db760bee2c460ca8e2c302190725fa0c50bfb9d6a9f6264a9a43db7a6b7b4e0b73c4c749b94dcac55cc58c33fd1bf74a08054469aec1cad15ef61265695889d04d74bb30cb8afdfab254b0516991d0ea4a0ebf31de7e6f48c12bd51c514bac4a6b039e08649cd1dc8ac3addadb688a6820fa01057cd44b1041c12ba1186c7fffb7c4742e3072a15b55292b3e2220f2685bd58a0c15322d14d139a3be4faf0c7df11fec00a899dbe790820bb515d803fe2b2efe580f902f020b902ec02f902e801838609d6b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100008000000000000000000000000004000000000000000000000008000000800000000000000000000100000000000000000000020000000000000000000800000000000100000080000010000000000000004000080000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000020000080004000000002000000000001000000010000400000000000000000100000000020000000000000000000000000000000000000000000000000000000000000100000f901ddf89b94c2132d05d31c914a87c6611c10748aeb04b58e8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b41536a682cee65205eeb94d174dd92c8b19a98ca00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000015d16af9013d940000000000000000000000000000000000001010f884a04dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63a00000000000000000000000000000000000000000000000000000000000001010a0000000000000000000000000b41536a682cee65205eeb94d174dd92c8b19a98ca0000000000000000000000000eedba2484aaf940f37cd3cd21a5d7c4a7dafbfc0b8a0000000000000000000000000000000000000000000000000000440890f7050080000000000000000000000000000000000000000000000006434dcb8705b6daa00000000000000000000000000000000000000000000f8458e6b1a052a28d53b00000000000000000000000000000000000000000000000064309c2f60eb1da200000000000000000000000000000000000000000000f8458e6f5a8e3999254382002e80";

        vm.expectEmit();
        emit ERC20Predicate.ExitedERC20(address(0xB41536a682cEe65205EeB94D174dD92C8B19a98C), address(usdt), 1429866);
        rootChainManagerProxy.exit(inputData);

        // Try exiting a newer transaction which should not be processed
        // {
        //   "_id": "66e3e858883bee162b6dfbaa",
        //   "transactionIndex": 21,
        //   "sourceNetwork": -1,
        //   "destinationNetwork": 0,
        //   "blockNumber": 61765606,
        //   "amounts": [
        //     "0xa"
        //   ],
        //   "bridgeType": "POS",
        //   "dataType": "ERC20",
        //   "isDecoded": false,
        //   "status": "READY_TO_CLAIM",
        //   "timestamp": "2024-09-13T07:20:57.000Z",
        //   "tokenIds": [],
        //   "transactionHash": "0xe793270458fab78c83d7c7e6473b97867d68d825458b13486d95ef1450ab014e",
        //   "userAddress": "0x679606f3b37c49946f5aa7774a37f03387c7f264",
        //   "wrappedTokenAddress": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        //   "wrappedTokenNetwork": -1
        // }
        // See: https://polygonscan.com/tx/0xe793270458fab78c83d7c7e6473b97867d68d825458b13486d95ef1450ab014e
        inputData =
            hex"f90a478428e200e0b90120152cf993278e2b7a76df82a08e359936fdcf8f02bdc4489d88d81cb2f5d3dd898e329f46972df06538f5a59965f4c1167ea8a0dae5e24df83593144dec21f423a601e8805347f6a6a16d8997ffabe975db52f222d83c6640551cc0a7ce0fea8cb8f7380e10247130e8d1dbe910e5ac1be4a994fec93ce0aaef603b9adda6c37d4e89c09be98e5c8392d09d3c44f1d2c1d9693f30547f46e874f1860a0bd7195380a19b263f219552f4f12232515de99e788d95b1b4bb2491fca29626562629d3bf9c8880c7641d0553009cb7e1b8c1a0a69eec506be5dbaf11c9ae495ddd662b6eca8528c3cc9e179f90eb441b9da1d64d78fb4f5101ad1ab707ef6694f6ab0e7550d959ee20f2d9f0d8f64499c7e0b55ccc0ca8017230a1ae1fa399f0c861f58403ae77e68466e3e7d9a09c833cb4cde6b799b50bbb82404810fdcbc44019380175b47f27482c981c99f5a03b30be66c8f5f91000feeb4786b1a095e13631d525eb6bc8dbface692f8a289bb902ec02f902e8018388032eb9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100108000000000000000000000000000000000000000008000000008000000800000000000000000000100000000000000000000020000000000000000000800000000000800100080000010000000000000000000080000000000000000000000000000000000000000000000008000200000000000000000000000000000000000000000000000000000000000004000000002000000000001000000002000400000000000000000100000000020000000000000000000000000000000000000000000000000000000000000100000f901ddf89b94c2132d05d31c914a87c6611c10748aeb04b58e8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000679606f3b37c49946f5aa7774a37f03387c7f264a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000af9013d940000000000000000000000000000000000001010f884a04dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63a00000000000000000000000000000000000000000000000000000000000001010a0000000000000000000000000679606f3b37c49946f5aa7774a37f03387c7f264a000000000000000000000000083d69448f88bf9c701c1b93f43e1f753d39b2632b8a00000000000000000000000000000000000000000000000000007902231ce0c900000000000000000000000000000000000000000000000001d1cd8c79ef350e30000000000000000000000000000000000000000000014d2a146b812e02535950000000000000000000000000000000000000000000000001d1548a56d2544530000000000000000000000000000000000000000000014d2a14e483511f34225b905ddf905daf8d1a0826cae2e766c25414327ea2dea049bc333fe40d726220d792fe99e31d496c342a04c997bb68aee97a3e5b9b28a47d93627cb8b3869bfc50a5294a1f612548c3795a07d938d881ea72a81995f254b7a4fc73e8a9f345720b6e3b07cd15b4e4cf3df56a00b0b8a49ee481738f2d8697eabc2ff3badfc952d3fe32120218069a6e90e3e71a025ddb46349486322622163b82e5ee73f1f5bc222d1d29559f91975e875ccd47d808080a0068e2107374ad441cdaa7b405846ff71c5021a57943a175d33461baac0c837fa8080808080808080f90211a0bfbbfc7e491f94ab78bc382a869cdb0303fd0188473b89a228c8298871ed2287a0f5929fa84ac9b4075799a9d18aab6caf2cde17049c1264a54327b72ab9861e25a050bf262d9f7f39671f98909187d4a0df624ee277729671d3830e902c85e8e827a026193c8cc4ee96701ad271de43ce8f8ce690ae52ae4809048ecf5ee4b99a861ea01840726d9fb56f9edc55bbb2479327625f20531b408827ac9ccbfcbc81dc1243a02ac9759995f30361ee358eeb1916f8bdf88917c97b4667c0d155f0da13cbc0d5a0f456e5254c8541789b59dd10209b13b21181452183e0ff35f9cb7be11d2b230aa0ce5c2be095071176798026cbae6345a3e8f1b01907a237fadc0d363856c97bf3a0aebd3be7936824b3b82a36c4ffd3a38c8c1b981e2b6f232806ab32fc94671d7ca0187fc06f492756277662fb015126962f163cdded2bb9269465597070ff95e3bca017d17f42128e4f43de0358e6f97ec076e79e805d7a34c773a60b9428b8b9ff1ca02e06b4a597ac1e57a15bbfac86b06da74292515d8201680092ed0527d3c07ef2a05244bd72d38f3f7feb5fef6a3e4499084b36604c72bdecb1b36650537e0a0b74a04c6220977c5de7e253629f0f1a1929e082bb0ceacaf6f64fdab8ee634e26b368a01fe9e5d4de263ffd1184b998f3f5d9f706f4753a3ea8e36703662860b575b311a0ac08e245f2645791ca5b7e539d1810612205458284c4469b3a218658d735f43480f902f020b902ec02f902e8018388032eb9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100108000000000000000000000000000000000000000008000000008000000800000000000000000000100000000000000000000020000000000000000000800000000000800100080000010000000000000000000080000000000000000000000000000000000000000000000008000200000000000000000000000000000000000000000000000000000000000004000000002000000000001000000002000400000000000000000100000000020000000000000000000000000000000000000000000000000000000000000100000f901ddf89b94c2132d05d31c914a87c6611c10748aeb04b58e8ff863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000679606f3b37c49946f5aa7774a37f03387c7f264a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000af9013d940000000000000000000000000000000000001010f884a04dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63a00000000000000000000000000000000000000000000000000000000000001010a0000000000000000000000000679606f3b37c49946f5aa7774a37f03387c7f264a000000000000000000000000083d69448f88bf9c701c1b93f43e1f753d39b2632b8a00000000000000000000000000000000000000000000000000007902231ce0c900000000000000000000000000000000000000000000000001d1cd8c79ef350e30000000000000000000000000000000000000000000014d2a146b812e02535950000000000000000000000000000000000000000000000001d1548a56d2544530000000000000000000000000000000000000000000014d2a14e483511f3422582001580";

        vm.expectRevert("RootChainManager: EXIT_DISABLED");
        rootChainManagerProxy.exit(inputData);
    }

    function test_usdtMigration() public {
        string memory updateInput = _getUpdateTokenMigrationStatusInputs(address(usdt), true, true, 1);
        bytes memory updateCallData = updateTokenMigrationStatusScript.run(updateInput);
        vm.prank(address(safeMultisig));
        (bool updateSuccess,) = address(rootChainManagerProxy).call(updateCallData);
        assertTrue(updateSuccess, "Failed to disable USDT deposit and exit");

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

    // Helper to write the inputs for the grant role script
    function _getGrantRoleInputs(string memory role, address account) internal returns (string memory) {
        string memory obj1 = "GRObject";
        string memory obj2 = "GRValueObject";
        vm.serializeString(obj2, "role", role);
        string memory output = vm.serializeAddress(obj2, "account", account);
        return vm.serializeString(obj1, "grantRole", output);
    }

    // Helper to write the inputs for the update implementation script
    function _getUpdateImplInputs(
        string memory contractName,
        address proxyAddress,
        bytes memory updateData,
        uint256 delay
    ) internal returns (string memory) {
        string memory obj1 = "UIObject";
        string memory obj2 = "UIValueObject";
        vm.serializeString(obj2, "contractName", contractName);
        vm.serializeAddress(obj2, "proxyAddress", proxyAddress);
        vm.serializeBytes(obj2, "updateData", updateData);
        string memory output = vm.serializeUint(obj2, "delay", delay);
        return vm.serializeString(obj1, "upgradeImplementation", output);
    }

    // Helper to write the inputs for the update token migration status script
    function _getUpdateTokenMigrationStatusInputs(
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
        return vm.serializeString(obj1, "updateTokenMigrationStatus", output);
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

        (bool success) = safeMultisig.execTransaction(
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
        vm.assertTrue(success, "Failed to execute timelock operation");

        vm.stopPrank();
    }
}
