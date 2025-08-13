pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "lib/forge-std/src/Test.sol";

import {DummyERC20} from "contracts/root/RootToken/DummyERC20.sol";
import {DummyERC721} from "contracts/root/RootToken/DummyERC721.sol";
import {DummyERC1155} from "contracts/root/RootToken/DummyERC1155.sol";
import {DummyStateSender} from "contracts/root/StateSender/DummyStateSender.sol";
import {RootChainManager} from "contracts/root/RootChainManager/RootChainManager.sol";
import {RootChainManagerProxy} from "contracts/root/RootChainManager/RootChainManagerProxy.sol";

// Mocks
contract MockERC20Predicate {
    function lockTokens(address depositor, address depositReceiver, address rootToken, bytes calldata depositData)
        external
    {}
}

contract MockERC721Predicate {
    function lockTokens(address depositor, address depositReceiver, address rootToken, bytes calldata depositData)
        external
    {}
}

contract MockERC1155Predicate {
    function lockTokens(address depositor, address depositReceiver, address rootToken, bytes calldata depositData)
        external
    {}
}

contract RootChainManagerTest is Test {
    bytes32 constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 constant PREDICATE_ERC20 = keccak256("ERC20");
    bytes32 constant PREDICATE_ERC721 = keccak256("ERC721");
    bytes32 constant PREDICATE_ERC1155 = keccak256("ERC1155");
    address constant USDT_ADDRESS = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    DummyERC20 internal usdtRootToken = DummyERC20(USDT_ADDRESS);
    address internal usdtChildToken = makeAddr("dummyUsdtChild");

    RootChainManager internal rootChainManager;
    DummyERC20 internal dummyRootERC20;
    DummyERC721 internal dummyRootERC721;
    DummyERC1155 internal dummyRootERC1155;

    address internal rootChainManagerImpl;

    address internal owner = makeAddr("owner");
    address internal dummyChildERC20 = makeAddr("dummyChildERC20");
    address internal dummyChildERC721 = makeAddr("dummyChildERC721");
    address internal dummyChildERC1155 = makeAddr("dummyChildERC1155");

    event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data);
    event MigrationStatusChanged(
        address indexed rootToken, bool isDepositDisabled, bool isExitDisabled, uint256 lastExitBlockNumber
    );
    event TokenMapped(address indexed rootToken, address indexed childToken, bytes32 indexed tokenType);

    function setUp() public {
        // deploy the RootChainManager contract
        rootChainManagerImpl = address(new RootChainManager());
        address payable rootChainManagerProxy = payable(address(new RootChainManagerProxy(rootChainManagerImpl)));
        rootChainManager = RootChainManager(rootChainManagerProxy);
        rootChainManager.initialize(owner);

        // deploy the Dummy Token contracts
        dummyRootERC20 = new DummyERC20("Dummy Root ERC20", "ERC20");
        dummyRootERC721 = new DummyERC721("Dummy Root ERC721", "ERC721");
        dummyRootERC1155 = new DummyERC1155("ERC1155_URI");

        // Deploy dummy USDT contract and etch its bytecode to the USDT address
        vm.etch(USDT_ADDRESS, type(DummyERC20).runtimeCode);

        // setup
        vm.startPrank(owner);

        rootChainManager.grantRole(rootChainManager.MIGRATION_MANAGER_ROLE(), owner);
        rootChainManager.setStateSender(address(new DummyStateSender()));

        rootChainManager.registerPredicate(PREDICATE_ERC20, address(new MockERC20Predicate()));
        rootChainManager.registerPredicate(PREDICATE_ERC721, address(new MockERC721Predicate()));
        rootChainManager.registerPredicate(PREDICATE_ERC1155, address(new MockERC1155Predicate()));

        vm.stopPrank();
    }

    function test_setUp() public view {
        assertEq(rootChainManager.DEPOSIT(), keccak256("DEPOSIT"));
        assertEq(rootChainManager.MAP_TOKEN(), keccak256("MAP_TOKEN"));
        assertEq(rootChainManager.MAPPER_ROLE(), keccak256("MAPPER_ROLE"));
        assertEq(rootChainManager.hasRole(rootChainManager.DEFAULT_ADMIN_ROLE(), owner), true);
        assertEq(rootChainManager.hasRole(rootChainManager.MAPPER_ROLE(), owner), true);
    }

    function test_depositFor_disabled() public {
        // Step 0: verify that only the usdt is allowed to be migrated
        vm.expectRevert("RootChainManager: ONLY_USDT_ALLOWED");
        _updateTokenMigrationStatus(address(dummyRootERC20), true, false, 0);

        // Step 1: verify that the token is not mapped yet
        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        _updateTokenMigrationStatus(address(usdtRootToken), true, false, 0);

        // Step 2: verify that the deposit is enabled by default
        _mapTokens();
        deal(address(usdtRootToken), address(this), 100);
        bytes memory syncData = _generateSyncData(DEPOSIT, address(this), address(usdtRootToken), bytes("100"));

        vm.expectEmit();
        emit StateSynced(1, address(0), syncData);
        rootChainManager.depositFor(address(this), address(usdtRootToken), bytes("100"));

        // Step 3: verify that the deposit is disabled after updating the token migration status
        vm.expectEmit();
        emit MigrationStatusChanged(address(usdtRootToken), true, false, 0);
        _updateTokenMigrationStatus(address(usdtRootToken), true, false, 0);

        vm.expectRevert("RootChainManager: DEPOSIT_DISABLED");
        rootChainManager.depositFor(address(this), address(usdtRootToken), bytes("100"));

        // Step 4: verify that deposits for other predicates are still enabled
        vm.expectEmit();
        emit StateSynced(
            1, address(0), _generateSyncData(DEPOSIT, address(this), address(dummyRootERC721), bytes("100"))
        );
        rootChainManager.depositFor(address(this), address(dummyRootERC721), bytes("100"));

        vm.expectEmit();
        emit StateSynced(
            1, address(0), _generateSyncData(DEPOSIT, address(this), address(dummyRootERC1155), bytes("100"))
        );
        rootChainManager.depositFor(address(this), address(dummyRootERC1155), bytes("100"));

        // Step 5: verify that the deposit is working again after updating the token migration status
        vm.expectEmit();
        emit MigrationStatusChanged(address(usdtRootToken), false, false, 0);
        _updateTokenMigrationStatus(address(usdtRootToken), false, false, 0);

        vm.expectEmit();
        emit StateSynced(1, address(0), syncData);
        rootChainManager.depositFor(address(this), address(usdtRootToken), bytes("100"));
    }

    function test_isMigrated_onlyDepositDisabled() public {
        _mapTokens();

        // Disable only deposits
        _updateTokenMigrationStatus(address(usdtRootToken), true, false, 0);

        // Test that isMigrated returns false when only deposits are disabled
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), false);

        // Other tokens should still return false
        assertEq(rootChainManager.isMigrated(address(dummyRootERC721)), false);
        assertEq(rootChainManager.isMigrated(address(dummyRootERC1155)), false);
    }

    function test_isMigrated_onlyExitDisabled() public {
        _mapTokens();

        // Disable only exits
        _updateTokenMigrationStatus(address(usdtRootToken), false, true, 100);

        // Test that isMigrated returns false when only exits are disabled
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), false);

        // Other tokens should still return false
        assertEq(rootChainManager.isMigrated(address(dummyRootERC721)), false);
        assertEq(rootChainManager.isMigrated(address(dummyRootERC1155)), false);
    }

    function test_isMigrated_fullyMigrated() public {
        _mapTokens();

        // Disable both deposits and exits
        _updateTokenMigrationStatus(address(usdtRootToken), true, true, 200);

        // Test that isMigrated returns true when both deposits and exits are disabled
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), true);

        // Other tokens should still return false
        assertEq(rootChainManager.isMigrated(address(dummyRootERC721)), false);
        assertEq(rootChainManager.isMigrated(address(dummyRootERC1155)), false);
    }

    function test_isMigrated_revertMigration() public {
        _mapTokens();

        // First, fully migrate the token
        _updateTokenMigrationStatus(address(usdtRootToken), true, true, 500);
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), true);

        // Then, revert the migration by enabling deposits
        _updateTokenMigrationStatus(address(usdtRootToken), false, true, 500);
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), false);

        // Revert the migration by enabling exits
        _updateTokenMigrationStatus(address(usdtRootToken), true, false, 500);
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), false);

        // Both should be enabled again
        _updateTokenMigrationStatus(address(usdtRootToken), false, false, 0);
        assertEq(rootChainManager.isMigrated(address(usdtRootToken)), false);
    }

    function test_cleanMapToken_revert() public {
        _mapTokens();

        address nonAdmin = makeAddr("nonAdmin");
        vm.expectRevert("RootChainManager: INSUFFICIENT_PERMISSIONS");
        vm.prank(nonAdmin);
        rootChainManager.cleanMapToken(address(dummyRootERC20), dummyChildERC20);

        // Should revert when trying to clean migrated token
        _updateTokenMigrationStatus(address(usdtRootToken), true, true, 0);
        vm.expectRevert("RootChainManager: CANNOT_CLEAN_MIGRATED_TOKEN");
        vm.prank(owner);
        rootChainManager.cleanMapToken(address(usdtRootToken), usdtChildToken);
    }

    function test_cleanMapToken() public {
        _mapTokens();

        // Verify tokens are mapped before cleaning
        assertEq(rootChainManager.rootToChildToken(address(dummyRootERC20)), dummyChildERC20);
        assertEq(rootChainManager.childToRootToken(dummyChildERC20), address(dummyRootERC20));
        assertEq(rootChainManager.tokenToType(address(dummyRootERC20)), PREDICATE_ERC20);

        // Test successful clean
        vm.expectEmit();
        emit TokenMapped(address(dummyRootERC20), dummyChildERC20, bytes32(0));
        vm.prank(owner);
        rootChainManager.cleanMapToken(address(dummyRootERC20), dummyChildERC20);

        // Verify tokens are unmapped after cleaning
        assertEq(rootChainManager.rootToChildToken(address(dummyRootERC20)), address(0));
        assertEq(rootChainManager.childToRootToken(dummyChildERC20), address(0));
        assertEq(rootChainManager.tokenToType(address(dummyRootERC20)), bytes32(0));

        // Test that other tokens are still mapped
        assertEq(rootChainManager.rootToChildToken(address(usdtRootToken)), usdtChildToken);
        assertEq(rootChainManager.childToRootToken(usdtChildToken), address(usdtRootToken));
        assertEq(rootChainManager.tokenToType(address(usdtRootToken)), PREDICATE_ERC20);
    }

    function test_remapToken_revert() public {
        _mapTokens();

        address nonAdmin = makeAddr("nonAdmin");
        address newChildToken = makeAddr("newChildToken");

        vm.expectRevert("RootChainManager: INSUFFICIENT_PERMISSIONS");
        vm.prank(nonAdmin);
        rootChainManager.remapToken(address(dummyRootERC20), newChildToken, PREDICATE_ERC20);

        // Should revert when trying to remap migrated token
        _updateTokenMigrationStatus(address(usdtRootToken), true, true, 0);
        vm.expectRevert("RootChainManager: CANNOT_REMAP_MIGRATED_TOKEN");
        vm.prank(owner);
        rootChainManager.remapToken(address(usdtRootToken), newChildToken, PREDICATE_ERC20);
    }

    function test_remapToken() public {
        _mapTokens();

        address newChildToken = makeAddr("newChildToken");

        // Verify tokens are mapped before remapping
        assertEq(rootChainManager.rootToChildToken(address(dummyRootERC20)), dummyChildERC20);
        assertEq(rootChainManager.childToRootToken(dummyChildERC20), address(dummyRootERC20));
        assertEq(rootChainManager.tokenToType(address(dummyRootERC20)), PREDICATE_ERC20);

        // Test successful remap - should emit TokenMapped event with new mapping
        vm.expectEmit();
        emit TokenMapped(address(dummyRootERC20), newChildToken, PREDICATE_ERC20);
        vm.prank(owner);
        rootChainManager.remapToken(address(dummyRootERC20), newChildToken, PREDICATE_ERC20);

        // Verify tokens are remapped correctly
        assertEq(rootChainManager.rootToChildToken(address(dummyRootERC20)), newChildToken);
        assertEq(rootChainManager.childToRootToken(newChildToken), address(dummyRootERC20));
        assertEq(rootChainManager.tokenToType(address(dummyRootERC20)), PREDICATE_ERC20);

        // Verify old child token mapping is cleaned up
        assertEq(rootChainManager.childToRootToken(dummyChildERC20), address(0));

        // Test that other tokens are still mapped
        assertEq(rootChainManager.rootToChildToken(address(usdtRootToken)), usdtChildToken);
        assertEq(rootChainManager.childToRootToken(usdtChildToken), address(usdtRootToken));
        assertEq(rootChainManager.tokenToType(address(usdtRootToken)), PREDICATE_ERC20);
    }

    function _generateSyncData(bytes32 action, address user, address rootToken, bytes memory depositData)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(action, abi.encode(user, rootToken, depositData));
    }

    function _updateTokenMigrationStatus(
        address token,
        bool isDepositDisabled,
        bool isExitDisabled,
        uint256 lastExitBlockNumber
    ) internal {
        vm.prank(owner);
        rootChainManager.updateTokenMigrationStatus(token, isDepositDisabled, isExitDisabled, lastExitBlockNumber);
    }

    function _mapTokens() internal {
        vm.startPrank(owner);
        rootChainManager.mapToken(address(usdtRootToken), usdtChildToken, PREDICATE_ERC20);
        rootChainManager.mapToken(address(dummyRootERC20), dummyChildERC20, PREDICATE_ERC20);
        rootChainManager.mapToken(address(dummyRootERC721), dummyChildERC721, PREDICATE_ERC721);
        rootChainManager.mapToken(address(dummyRootERC1155), dummyChildERC1155, PREDICATE_ERC1155);
        vm.stopPrank();
    }
}
