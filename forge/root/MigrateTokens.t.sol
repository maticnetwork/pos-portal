pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "lib/forge-std/src/Test.sol";

// Dummy ERC contracts
import {DummyERC20} from "contracts/root/RootToken/DummyERC20.sol";
import {DummyERC721} from "contracts/root/RootToken/DummyERC721.sol";
import {DummyERC1155} from "contracts/root/RootToken/DummyERC1155.sol";
import {DummyMintableERC20} from "contracts/root/RootToken/DummyMintableERC20.sol";
import {DummyMintableERC721} from "contracts/root/RootToken/DummyMintableERC721.sol";
import {DummyMintableERC1155} from "contracts/root/RootToken/DummyMintableERC1155.sol";

// Predicates
import {ERC20Predicate} from "contracts/root/TokenPredicates/ERC20Predicate.sol";
import {ERC721Predicate} from "contracts/root/TokenPredicates/ERC721Predicate.sol";
import {ERC1155Predicate} from "contracts/root/TokenPredicates/ERC1155Predicate.sol";
import {MintableERC20Predicate} from "contracts/root/TokenPredicates/MintableERC20Predicate.sol";
import {MintableERC721Predicate} from "contracts/root/TokenPredicates/MintableERC721Predicate.sol";
import {MintableERC1155Predicate} from "contracts/root/TokenPredicates/MintableERC1155Predicate.sol";
import {EtherPredicate} from "contracts/root/TokenPredicates/EtherPredicate.sol";

// Other contracts
import {DummyStateSender} from "contracts/root/StateSender/DummyStateSender.sol";
import {RootChainManager} from "contracts/root/RootChainManager/RootChainManager.sol";
import {RootChainManagerProxy} from "contracts/root/RootChainManager/RootChainManagerProxy.sol";
import {UpgradableProxy} from "contracts/common/Proxy/UpgradableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DummyERC1155MultiMint is DummyERC1155 {
    constructor(string memory uri_)
        public
        DummyERC1155(uri_)
    {}

    function mintBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public {
        _mintBatch(account, ids, amounts, data);
    }
}

contract MigrateTokens is Test {
    // Constants
    address constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes32 constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 constant PREDICATE_ERC20 = keccak256("ERC20");
    bytes32 constant PREDICATE_ERC721 = keccak256("ERC721");
    bytes32 constant PREDICATE_ERC1155 = keccak256("ERC1155");
    bytes32 constant PREDICATE_MINTABLE_ERC20 = keccak256("MINTABLE_ERC20");
    bytes32 constant PREDICATE_MINTABLE_ERC721 = keccak256("MINTABLE_ERC721");
    bytes32 constant PREDICATE_MINTABLE_ERC1155 = keccak256("MINTABLE_ERC1155");
    bytes32 constant PREDICATE_ETHER = keccak256("Ether");
    uint256 constant ERC20_MINT_AMOUNT = 1000 * 10**18;
    uint256 constant ERC721_MINT_ID = 1;
    uint256 constant ERC1155_MINT_ID = 1;
    uint256 constant ERC1155_MINT_AMOUNT = 1000;
    uint256 constant ETHER_MINT_AMOUNT = 1000 ether;

    // Dummy tokens
    DummyERC20 internal dummyRootERC20;
    DummyERC721 internal dummyRootERC721;
    DummyERC1155MultiMint internal dummyRootERC1155;
    DummyMintableERC721 internal dummyMintableRootERC721;
    DummyMintableERC20 internal dummyMintableRootERC20;
    DummyMintableERC1155 internal dummyMintableRootERC1155;

    // Predicates
    ERC20Predicate internal erc20Predicate;
    ERC721Predicate internal erc721Predicate;
    ERC1155Predicate internal erc1155Predicate;
    MintableERC20Predicate internal mintableErc20Predicate;
    MintableERC721Predicate internal mintableErc721Predicate;
    MintableERC1155Predicate internal mintableErc1155Predicate;
    EtherPredicate internal etherPredicate;

    RootChainManager internal rootChainManager;
    address internal rootChainManagerImpl;

    address internal owner = makeAddr("owner");
    address internal receiver = makeAddr("receiver");
    address internal dummyChildERC20 = makeAddr("dummyChildERC20");
    address internal dummyChildERC721 = makeAddr("dummyChildERC721");
    address internal dummyChildERC1155 = makeAddr("dummyChildERC1155");
    address internal dummyChildMintableERC20 = makeAddr("dummyChildMintableERC20");
    address internal dummyChildMintableERC721 = makeAddr("dummyChildMintableERC721");
    address internal dummyChildMintableERC1155 = makeAddr("dummyChildMintableERC1155");
    address internal dummyChildEther = makeAddr("dummyChildEther");

    function setUp() public {
        // deploy the RootChainManager contract
        rootChainManagerImpl = address(new RootChainManager());
        address payable rootChainManagerProxy = payable(address(new RootChainManagerProxy(rootChainManagerImpl)));
        rootChainManager = RootChainManager(rootChainManagerProxy);
        rootChainManager.initialize(owner);

        vm.startPrank(owner);
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
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC20),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount);
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC20),
            data
        );

        vm.stopPrank();

        assertEq(dummyRootERC20.balanceOf(receiver), amount);
        assertEq(dummyRootERC20.balanceOf(address(erc20Predicate)), 0);
    }

    function test_migrateERC721() public {
        uint256 tokenId = ERC721_MINT_ID;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC721),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSignature(
        "safeTransferFrom(address,address,uint256)",
            address(erc721Predicate),
            receiver,
            tokenId
        );
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC721),
            data
        );

        vm.stopPrank();

        assertEq(dummyRootERC721.balanceOf(receiver), tokenId);
        assertEq(dummyRootERC721.balanceOf(address(erc721Predicate)), 0);
    }

    function test_migrateERC1155() public {
        uint256 amount = ERC1155_MINT_AMOUNT;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC1155),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            address(erc1155Predicate),
            receiver,
            1,
            amount,
            bytes("")
        );
        rootChainManager.migrateBridgeFunds(
            address(dummyRootERC1155),
            data
        );

        vm.stopPrank();

        assertEq(dummyRootERC1155.balanceOf(receiver, ERC1155_MINT_ID), amount);
        assertEq(dummyRootERC1155.balanceOf(address(erc1155Predicate), ERC1155_MINT_ID), 0);
    }

    function test_migrateMintableERC20() public {
        uint256 amount = ERC20_MINT_AMOUNT;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC20),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount);
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC20),
            data
        );

        vm.stopPrank();

        assertEq(dummyMintableRootERC20.balanceOf(receiver), amount);
        assertEq(dummyMintableRootERC20.balanceOf(address(mintableErc20Predicate)), 0);
    }

    function test_migrateMintableERC721() public {
        uint256 tokenId = ERC721_MINT_ID;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC721),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256)",
            address(mintableErc721Predicate),
            receiver,
            tokenId
        );
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC721),
            data
        );

        vm.stopPrank();

        assertEq(dummyMintableRootERC721.balanceOf(receiver), tokenId);
        assertEq(dummyMintableRootERC721.balanceOf(address(mintableErc721Predicate)), 0);
    }

    function test_migrateMintableERC1155() public {
        uint256 amount = ERC1155_MINT_AMOUNT;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC1155),
            bytes("")
        );

        _registerPredicates();
        _mapTokens();

        bytes memory data = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            address(mintableErc1155Predicate),
            receiver,
            1,
            amount,
            bytes("")
        );
        rootChainManager.migrateBridgeFunds(
            address(dummyMintableRootERC1155),
            data
        );

        vm.stopPrank();

        assertEq(dummyMintableRootERC1155.balanceOf(receiver, ERC1155_MINT_ID), amount);
        assertEq(dummyMintableRootERC1155.balanceOf(address(mintableErc1155Predicate), ERC1155_MINT_ID), 0);
    }

    function test_etherMigration() public {
        uint256 amount = ETHER_MINT_AMOUNT;

        vm.startPrank(owner);

        vm.expectRevert("RootChainManager: TOKEN_NOT_MAPPED");
        rootChainManager.migrateBridgeFunds(
            ETHER_ADDRESS,
            bytes("")
        );
        _registerPredicates();
        _mapTokens();
        bytes memory data = abi.encode(receiver, amount); // Special data format for EtherPredicate
        rootChainManager.migrateBridgeFunds(
            ETHER_ADDRESS,
            data
        );

        vm.stopPrank();

        assertEq(address(receiver).balance, amount);
        assertEq(address(etherPredicate).balance, 0);
    }

    // @dev Requires owner privilege
    function _deployTokensAndPredicates() internal {
        // deploy the Dummy Token contracts
        dummyRootERC20 = new DummyERC20("Dummy Root ERC20", "ERC20");
        dummyRootERC721 = new DummyERC721("Dummy Root ERC721", "ERC721");
        dummyRootERC1155 = new DummyERC1155MultiMint("ERC1155_URI");
        dummyMintableRootERC20 = new DummyMintableERC20("Dummy Mintable Root ERC20", "MINTABLE_ERC20");
        dummyMintableRootERC721 = new DummyMintableERC721("Dummy Mintable Root ERC721", "MINTABLE_ERC721");
        dummyMintableRootERC1155 = new DummyMintableERC1155("MINTABLE_ERC1155_URI");

        // deploy the Predicate contracts
        erc20Predicate = ERC20Predicate(_proxify(address(new ERC20Predicate())));
        erc20Predicate.initialize(address(rootChainManager));
        erc721Predicate = ERC721Predicate(_proxify(address(new ERC721Predicate())));
        erc721Predicate.initialize(address(rootChainManager));
        erc1155Predicate = ERC1155Predicate(_proxify(address(new ERC1155Predicate())));
        erc1155Predicate.initialize(address(rootChainManager));
        mintableErc20Predicate = MintableERC20Predicate(_proxify(address(new MintableERC20Predicate())));
        mintableErc20Predicate.initialize(address(rootChainManager));
        mintableErc721Predicate = MintableERC721Predicate(_proxify(address(new MintableERC721Predicate())));
        mintableErc721Predicate.initialize(address(rootChainManager));
        mintableErc1155Predicate = MintableERC1155Predicate(_proxify(address(new MintableERC1155Predicate())));
        mintableErc1155Predicate.initialize(address(rootChainManager));
        etherPredicate = EtherPredicate(payable(_proxify(address(new EtherPredicate()))));
        etherPredicate.initialize(address(rootChainManager));
    }

    function _registerPredicates() internal {
        // Register the predicates
        rootChainManager.registerPredicate(PREDICATE_ERC20, address(erc20Predicate));
        rootChainManager.registerPredicate(PREDICATE_ERC721, address(erc721Predicate));
        rootChainManager.registerPredicate(PREDICATE_ERC1155, address(erc1155Predicate));
        rootChainManager.registerPredicate(PREDICATE_MINTABLE_ERC20, address(mintableErc20Predicate));
        rootChainManager.registerPredicate(PREDICATE_MINTABLE_ERC721, address(mintableErc721Predicate));
        rootChainManager.registerPredicate(PREDICATE_MINTABLE_ERC1155, address(mintableErc1155Predicate));
        rootChainManager.registerPredicate(PREDICATE_ETHER, address(etherPredicate));
    }

    function _mapTokens() internal {
        // Map the tokens to their respective predicates
        rootChainManager.mapToken(address(dummyRootERC20), dummyChildERC20, PREDICATE_ERC20);
        rootChainManager.mapToken(address(dummyRootERC721), dummyChildERC721, PREDICATE_ERC721);
        rootChainManager.mapToken(address(dummyRootERC1155), dummyChildERC1155, PREDICATE_ERC1155);
        rootChainManager.mapToken(address(dummyMintableRootERC20), dummyChildMintableERC20, PREDICATE_MINTABLE_ERC20);
        rootChainManager.mapToken(address(dummyMintableRootERC721), dummyChildMintableERC721, PREDICATE_MINTABLE_ERC721);
        rootChainManager.mapToken(address(dummyMintableRootERC1155), dummyChildMintableERC1155, PREDICATE_MINTABLE_ERC1155);
        rootChainManager.mapToken(ETHER_ADDRESS, dummyChildEther, PREDICATE_ETHER);
    }

    function _mintTokens() internal {
        vm.prank(address(erc20Predicate));
        dummyRootERC20.mint(ERC20_MINT_AMOUNT);
        vm.prank(address(erc721Predicate));
        dummyRootERC721.mint(ERC721_MINT_ID);
        uint256[] memory tokenIds = new uint256[](1);
        uint256[] memory tokenAmounts = new uint256[](1);
        tokenIds[0] = ERC1155_MINT_ID;
        tokenAmounts[0] = ERC1155_MINT_AMOUNT;
        dummyRootERC1155.mintBatch(
            address(erc1155Predicate),
            tokenIds,
            tokenAmounts,
            bytes("")
        );

        vm.startPrank(owner);

        dummyMintableRootERC20.mint(address(mintableErc20Predicate), ERC20_MINT_AMOUNT);
        dummyMintableRootERC721.mint(address(mintableErc721Predicate), ERC721_MINT_ID);
        dummyMintableRootERC1155.mintBatch(
            address(mintableErc1155Predicate),
            tokenIds,
            tokenAmounts,
            bytes("")
        );

        vm.stopPrank();
        vm.deal(address(etherPredicate), ETHER_MINT_AMOUNT);
    }

    function _proxify(address logic) internal returns (address proxy) {
        proxy = address(new UpgradableProxy(logic));
    }
}
