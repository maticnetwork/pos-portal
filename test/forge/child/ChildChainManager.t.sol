// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "forge-std/Test.sol";

import {ChildChainManager} from "contracts/child/ChildChainManager/ChildChainManager.sol";
import {ChildChainManagerProxy} from "contracts/child/ChildChainManager/ChildChainManagerProxy.sol";
import {ChildERC20} from "contracts/child/ChildToken/ChildERC20.sol";

abstract contract UninitializedState is Test {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    ChildChainManager internal childChainManager;
    ChildChainManager internal childChainManagerImpl;

    bytes internal revertMsg = "ChildChainManager: INSUFFICIENT_PERMISSIONS";

    function setUp() public virtual {
        childChainManagerImpl = new ChildChainManager();
        address childChainManagerProxy = address(new ChildChainManagerProxy(address(childChainManagerImpl)));
        childChainManager = ChildChainManager(childChainManagerProxy);
    }
}

contract ChildChainManagerTest_Uninitialized is UninitializedState {
    function testConstants() public {
        assertEq(childChainManager.DEPOSIT(), keccak256("DEPOSIT"));
        assertEq(childChainManager.MAP_TOKEN(), keccak256("MAP_TOKEN"));
        assertEq(childChainManager.MAPPER_ROLE(), keccak256("MAPPER_ROLE"));
        assertEq(
            childChainManager.STATE_SYNCER_ROLE(),
            keccak256("STATE_SYNCER_ROLE")
        );
    }

    function testInitialize() public {
        vm.expectEmit();
        emit RoleGranted(
            childChainManager.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childChainManager.MAPPER_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childChainManager.STATE_SYNCER_ROLE(),
            address(this),
            address(this)
        );

        childChainManager.initialize(address(this));
    }

    function testInitializeImpl() public {
        vm.expectRevert("already inited");
        childChainManagerImpl.initialize(address(this));

        childChainManagerImpl = new ChildChainManager();

        vm.expectRevert("already inited");
        childChainManagerImpl.initialize(address(this));
    }
}

abstract contract InitializedState is UninitializedState {
    event TokenMapped(address indexed rootToken, address indexed childToken);
    event TokenUnmapped(address indexed rootToken, address indexed childToken);

    address internal immutable ALIEN = makeAddr("alien");

    function setUp() public override {
        super.setUp();

        childChainManager.initialize(address(this));
    }
}

contract ChildChainManagerTest_Initialized is InitializedState {
    function testCannotInitialize_AlreadyInited() public {
        vm.expectRevert("already inited");

        childChainManager.initialize(address(this));
    }

    function testCannotMapToken_OnlyMapper() public {
        vm.prank(ALIEN);
        vm.expectRevert(revertMsg);

        childChainManager.mapToken(address(0), address(0));
    }

    function testMapToken() public {
        address rootToken = makeAddr("rootToken");
        address childToken = makeAddr("childToken");

        vm.expectEmit();
        emit TokenMapped(rootToken, childToken);

        childChainManager.mapToken(rootToken, childToken);

        assertEq(childChainManager.rootToChildToken(rootToken), childToken);
        assertEq(childChainManager.childToRootToken(childToken), rootToken);
    }

    function testMapToken_CleanUp() public {
        address rootToken = makeAddr("rootToken");
        address childToken = makeAddr("childToken");

        childChainManager.mapToken(rootToken, childToken);

        // Change child token address - old one shouldn't be mapped anymore.

        address newChildToken = makeAddr("newChildToken");

        childChainManager.mapToken(rootToken, newChildToken);

        address oldChildToken = childToken;

        assertEq(childChainManager.childToRootToken(oldChildToken), address(0));

        childToken = newChildToken;

        // Change root token address - old one shouldn't be mapped anymore.

        address newRootToken = makeAddr("newRootToken");

        childChainManager.mapToken(newRootToken, childToken);

        address oldRootToken = rootToken;

        assertEq(childChainManager.rootToChildToken(oldRootToken), address(0));
    }

    function testCannotOnStateReceive_OnlyStateSyncer() public {
        vm.prank(ALIEN);
        vm.expectRevert(revertMsg);

        childChainManager.onStateReceive(0, "");
    }

    function testCannotOnStateReceive_InvalidSyncType() public {
        vm.expectRevert("ChildChainManager: INVALID_SYNC_TYPE");

        bytes32 invalidSyncType;
        bytes memory syncData = abi.encode(address(0), address(0), bytes32(0));
        bytes memory data = abi.encode(invalidSyncType, syncData);

        childChainManager.onStateReceive(0, data);
    }

    function testOnStateReceive_Mapping() public {
        address rootToken = makeAddr("rootToken");
        address childToken = makeAddr("childToken");

        bytes32 syncType = childChainManager.MAP_TOKEN();
        bytes memory syncData = abi.encode(rootToken, childToken, bytes32(0));
        bytes memory data = abi.encode(syncType, syncData);

        vm.expectEmit();
        emit TokenMapped(rootToken, childToken);

        childChainManager.onStateReceive(0, data);
    }

    function testCannotOnStateReceive_Depositing_TokenNotMapped() public {
        address unmappedRootToken = makeAddr("unmappedRootToken");

        bytes32 syncType = childChainManager.DEPOSIT();
        bytes memory syncData = abi.encode(address(0), unmappedRootToken, "");
        bytes memory data = abi.encode(syncType, syncData);

        vm.expectRevert("ChildChainManager: TOKEN_NOT_MAPPED");

        childChainManager.onStateReceive(0, data);
    }

    function testOnStateReceive_Depositing() public {
        ChildERC20 childTokenContract = new ChildERC20(
            "ChildERC20",
            "CHILD",
            18,
            address(childChainManager)
        );

        address rootToken = makeAddr("rootToken");
        address childToken = address(childTokenContract);

        childChainManager.mapToken(rootToken, childToken);

        address user = makeAddr("user");
        uint256 amount = 1 ether;
        bytes memory depositData = abi.encode(amount);

        bytes32 syncType = childChainManager.DEPOSIT();
        bytes memory syncData = abi.encode(user, rootToken, depositData);
        bytes memory data = abi.encode(syncType, syncData);

        childChainManager.onStateReceive(0, data);

        assertEq(childTokenContract.balanceOf(user), amount);
    }

    function testCannotCleanMapToken_OnlyMapper() public {
        vm.prank(ALIEN);
        vm.expectRevert(revertMsg);

        childChainManager.cleanMapToken(address(0), address(0));
    }

    function testCleanMapToken() public {
        address rootToken = makeAddr("rootToken");
        address childToken = makeAddr("childToken");

        childChainManager.mapToken(rootToken, childToken);

        vm.expectEmit();
        emit TokenUnmapped(rootToken, childToken);

        childChainManager.cleanMapToken(rootToken, childToken);

        assertEq(childChainManager.rootToChildToken(rootToken), address(0));
        assertEq(childChainManager.childToRootToken(childToken), address(0));
    }
}
