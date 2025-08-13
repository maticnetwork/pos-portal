pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "lib/forge-std/src/Test.sol";

// Dummy ERC contracts
import {DummyERC20} from "contracts/root/RootToken/DummyERC20.sol";

// Predicates
import {ERC20Predicate} from "contracts/root/TokenPredicates/ERC20Predicate.sol";

// Other contracts
import {DummyStateSender} from "contracts/root/StateSender/DummyStateSender.sol";
import {RootChainManager} from "contracts/root/RootChainManager/RootChainManager.sol";
import {RootChainManagerProxy} from "contracts/root/RootChainManager/RootChainManagerProxy.sol";
import {UpgradableProxy} from "contracts/common/Proxy/UpgradableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MigrateTokens is Test {
    // Constants
    address constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address constant USDT_ADDRESS = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    bytes32 constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 constant PREDICATE_ERC20 = keccak256("ERC20");
    uint256 constant ERC20_MINT_AMOUNT = 1000 * 10 ** 18;

    // Dummy tokens
    DummyERC20 internal usdtRootToken = DummyERC20(USDT_ADDRESS);

    // Predicates
    ERC20Predicate internal erc20Predicate;

    RootChainManager internal rootChainManager;
    address internal rootChainManagerImpl;

    address internal owner = makeAddr("owner");
    address internal receiver = makeAddr("receiver");
    address internal dummyChildERC20 = makeAddr("dummyChildERC20");

    function setUp() public {
        // deploy the RootChainManager contract
        rootChainManagerImpl = address(new RootChainManager());
        address payable rootChainManagerProxy = payable(address(new RootChainManagerProxy(rootChainManagerImpl)));
        rootChainManager = RootChainManager(rootChainManagerProxy);
        rootChainManager.initialize(owner);

        vm.startPrank(owner);
        rootChainManager.grantRole(rootChainManager.MIGRATION_MANAGER_ROLE(), owner);
        rootChainManager.setStateSender(address(new DummyStateSender()));
        _deployTokensAndPredicates();
        vm.stopPrank();
        _mintTokens();
    }

    function test_setUp() public view {
        assertEq(rootChainManager.DEPOSIT(), keccak256("DEPOSIT"));
        assertEq(rootChainManager.MAP_TOKEN(), keccak256("MAP_TOKEN"));
        assertEq(rootChainManager.MAPPER_ROLE(), keccak256("MAPPER_ROLE"));
        assertEq(rootChainManager.hasRole(rootChainManager.DEFAULT_ADMIN_ROLE(), owner), true);
        assertEq(rootChainManager.hasRole(rootChainManager.MAPPER_ROLE(), owner), true);
    }

    function test_migrateERC20() public {
        uint256 amount = ERC20_MINT_AMOUNT;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(address(usdtRootToken), bytes(""));

        _registerPredicates();
        _mapTokens();

        vm.expectRevert("RootChainManager: NOT_MIGRATED");
        rootChainManager.migrateBridgeFunds(address(usdtRootToken), bytes(""));

        // @note since only the USDT token is able to migrate, we use USDT for this test
        rootChainManager.updateTokenMigrationStatus(
            address(usdtRootToken),
            true, // isDepositDisabled
            true, // isExitDisabled
            0 // lastExitBlockNumber
        );

        bytes memory data = abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount);
        rootChainManager.migrateBridgeFunds(address(usdtRootToken), data);

        vm.stopPrank();

        assertEq(usdtRootToken.balanceOf(receiver), amount);
        assertEq(usdtRootToken.balanceOf(address(erc20Predicate)), 0);
    }

    // @dev Requires owner privilege
    function _deployTokensAndPredicates() internal {
        // Deploy dummy USDT contract and etch its bytecode to the USDT address
        vm.etch(USDT_ADDRESS, type(DummyERC20).runtimeCode);

        // deploy the Predicate contracts
        erc20Predicate = ERC20Predicate(_proxify(address(new ERC20Predicate())));
        erc20Predicate.initialize(address(rootChainManager));
    }

    function _registerPredicates() internal {
        // Register the predicates
        rootChainManager.registerPredicate(PREDICATE_ERC20, address(erc20Predicate));
    }

    function _mapTokens() internal {
        // Map the tokens to their respective predicates
        rootChainManager.mapToken(address(usdtRootToken), dummyChildERC20, PREDICATE_ERC20);
    }

    function _mintTokens() internal {
        vm.prank(address(erc20Predicate));
        usdtRootToken.mint(ERC20_MINT_AMOUNT);
    }

    function _proxify(address logic) internal returns (address proxy) {
        proxy = address(new UpgradableProxy(logic));
    }
}
