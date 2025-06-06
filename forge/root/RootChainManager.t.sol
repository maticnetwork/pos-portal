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
    event StoppageStatusChanged(
        address indexed rootToken, bool isDepositDisabled, bool isExitDisabled, uint256 lastExitBlockNumber
    );

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

        // setup
        vm.startPrank(owner);

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
        // Step 1: verify that the token is not mapped yet
        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        _updateTokenStoppageStatus(address(dummyRootERC20), true, false, 0);

        // Step 2: verify that the deposit is enabled by default
        _mapTokens();
        deal(address(dummyRootERC20), address(this), 100);
        bytes memory syncData = _generateSyncData(DEPOSIT, address(this), address(dummyRootERC20), bytes("100"));

        vm.expectEmit();
        emit StateSynced(1, address(0), syncData);
        rootChainManager.depositFor(address(this), address(dummyRootERC20), bytes("100"));

        // Step 3: verify that the deposit is disabled after updating the token stoppage status
        vm.expectEmit();
        emit StoppageStatusChanged(address(dummyRootERC20), true, false, 0);
        _updateTokenStoppageStatus(address(dummyRootERC20), true, false, 0);

        vm.expectRevert("RootChainManager: DEPOSIT_DISABLED");
        rootChainManager.depositFor(address(this), address(dummyRootERC20), bytes("100"));

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

        // Step 5: verify that the deposit is working again after updating the token stoppage status
        vm.expectEmit();
        emit StoppageStatusChanged(address(dummyRootERC20), false, false, 0);
        _updateTokenStoppageStatus(address(dummyRootERC20), false, false, 0);

        vm.expectEmit();
        emit StateSynced(1, address(0), syncData);
        rootChainManager.depositFor(address(this), address(dummyRootERC20), bytes("100"));
    }

    function _generateSyncData(bytes32 action, address user, address rootToken, bytes memory depositData)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(action, abi.encode(user, rootToken, depositData));
    }

    function _updateTokenStoppageStatus(
        address token,
        bool isDepositDisabled,
        bool isExitDisabled,
        uint256 lastExitBlockNumber
    ) internal {
        vm.prank(owner);
        rootChainManager.updateTokenStoppageStatus(token, isDepositDisabled, isExitDisabled, lastExitBlockNumber);
    }

    function _mapTokens() internal {
        vm.startPrank(owner);
        rootChainManager.mapToken(address(dummyRootERC20), dummyChildERC20, PREDICATE_ERC20);
        rootChainManager.mapToken(address(dummyRootERC721), dummyChildERC721, PREDICATE_ERC721);
        rootChainManager.mapToken(address(dummyRootERC1155), dummyChildERC1155, PREDICATE_ERC1155);
        vm.stopPrank();
    }
}
