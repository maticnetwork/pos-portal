// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {ChildMintableERC721} from "contracts/child/ChildToken/ChildMintableERC721.sol";

contract ChildMintableERC721Test is Test, NMTHelpers {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );
    event WithdrawnBatch(address indexed user, uint256[] tokenIds);
    event TransferWithMetadata(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        bytes metaData
    );

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    ChildMintableERC721 internal childMintableERC721;

    Account internal signer;
    address internal childChainManagerAddr;

    bytes internal revertMsg = "ChildMintableERC721: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");

        childMintableERC721 = new ChildMintableERC721(
            "Name",
            "Symbol",
            childChainManagerAddr
        );

        signer = makeAccount("signer");
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            childMintableERC721.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childMintableERC721.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        childMintableERC721 = new ChildMintableERC721(
            "Name",
            "Symbol",
            childChainManagerAddr
        );

        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("Name")),
                keccak256(bytes(childMintableERC721.ERC712_VERSION())),
                address(childMintableERC721),
                bytes32(childMintableERC721.getChainId())
            )
        );

        assertEq(childMintableERC721.name(), "Name");
        assertEq(childMintableERC721.symbol(), "Symbol");
        assertEq(
            childMintableERC721.getDomainSeperator(),
            expectedDomainSeperator
        );
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childMintableERC721.deposit(address(0), "");
    }

    function testDeposit_Single() public {
        address recipient = makeAddr("recipient");
        uint256 tokenId = 1337;

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit Transfer(address(0), recipient, tokenId);

        childMintableERC721.deposit(recipient, abi.encode(tokenId));

        assertEq(childMintableERC721.withdrawnTokens(tokenId), false);
        assertEq(childMintableERC721.ownerOf(1337), recipient);
    }

    function testDeposit_Batch() public {
        address recipient = makeAddr("recipient");
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;
        tokenIds[2] = 1339;

        vm.prank(childChainManagerAddr);

        for (uint256 i; i < tokenIds.length; ++i) {
            vm.expectEmit();
            emit Transfer(address(0), recipient, tokenIds[i]);
        }

        childMintableERC721.deposit(recipient, abi.encode(tokenIds));

        for (uint256 i; i < tokenIds.length; ++i) {
            assertEq(childMintableERC721.withdrawnTokens(tokenIds[i]), false);
            assertEq(childMintableERC721.ownerOf(tokenIds[i]), recipient);
        }
    }

    function testCannotWithdraw_InvalidOwner() public {
        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(1337));

        vm.prank(ALIEN);

        vm.expectRevert("ChildMintableERC721: INVALID_TOKEN_OWNER");

        childMintableERC721.withdraw(1337);
    }

    function testWithdraw() public {
        uint256 tokenId = 1337;

        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(tokenId));

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit Transfer(signer.addr, address(0), tokenId);

        executeMetaTransaction(
            address(childMintableERC721),
            abi.encodeWithSelector(
                childMintableERC721.withdraw.selector,
                tokenId
            ),
            signer
        );

        assertEq(childMintableERC721.withdrawnTokens(tokenId), true);
    }

    function testCannotWithdrawBatch_ExceedsBatchLimit() public {
        uint256[] memory tokenIds = new uint256[](
            childMintableERC721.BATCH_LIMIT() + 1
        );

        vm.expectRevert("ChildMintableERC721: EXCEEDS_BATCH_LIMIT");

        childMintableERC721.withdrawBatch(tokenIds);
    }

    function testCannotWithdrawBatch_InvalidOwner() public {
        vm.startPrank(childChainManagerAddr);
        childMintableERC721.deposit(address(this), abi.encode(1337));
        childMintableERC721.deposit(makeAddr("random"), abi.encode(1338));
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;

        // gibberish (token id was not converted to string before concatenation)
        vm.expectRevert(
            abi.encodePacked(
                "ChildMintableERC721: INVALID_TOKEN_OWNER ",
                uint256(1338)
            )
        );

        childMintableERC721.withdrawBatch(tokenIds);
    }

    function testWithdrawBatch() public {
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;
        tokenIds[2] = 1339;

        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(tokenIds));

        skipMetaTransactionEvent();

        for (uint256 i; i < tokenIds.length; ++i) {
            vm.expectEmit();
            emit Transfer(signer.addr, address(0), tokenIds[i]);
        }

        vm.expectEmit();
        emit WithdrawnBatch(signer.addr, tokenIds);

        executeMetaTransaction(
            address(childMintableERC721),
            abi.encodeWithSelector(
                childMintableERC721.withdrawBatch.selector,
                tokenIds
            ),
            signer
        );

        for (uint256 i; i < tokenIds.length; ++i) {
            assertEq(childMintableERC721.withdrawnTokens(tokenIds[i]), true);
        }
    }

    function testCannotWithdrawWithMetadata_InvalidOwner() public {
        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(1337));

        vm.prank(ALIEN);

        vm.expectRevert("ChildMintableERC721: INVALID_TOKEN_OWNER");

        childMintableERC721.withdrawWithMetadata(1337);
    }

    function testWithdrawWithMetadata() public {
        uint256 tokenId = 1337;

        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(tokenId));

        bytes memory metaData = childMintableERC721.encodeTokenMetadata(
            tokenId
        );

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit TransferWithMetadata(signer.addr, address(0), tokenId, metaData);

        vm.expectEmit();
        emit Transfer(signer.addr, address(0), tokenId);

        executeMetaTransaction(
            address(childMintableERC721),
            abi.encodeWithSelector(
                childMintableERC721.withdrawWithMetadata.selector,
                tokenId,
                metaData
            ),
            signer
        );

        assertEq(childMintableERC721.withdrawnTokens(tokenId), true);
    }

    function testEncodeTokenMetadata() public {
        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(signer.addr, abi.encode(1337));

        assertEq(
            childMintableERC721.encodeTokenMetadata(1337),
            abi.encode(childMintableERC721.tokenURI(1337))
        );
    }

    function testCannotMint_OnlyAdmin() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childMintableERC721.deposit(address(0), "");
    }

    function testCannotMint_WithdrawnToken() public {
        vm.prank(childChainManagerAddr);
        childMintableERC721.deposit(address(this), abi.encode(1337));

        childMintableERC721.withdraw(1337);

        vm.expectRevert("ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN");

        childMintableERC721.mint(address(this), 1337);
    }

    function testMint() public {
        address recipient = makeAddr("recipient");
        uint256 tokenId = 1337;

        vm.expectEmit();
        emit Transfer(address(0), recipient, tokenId);

        childMintableERC721.mint(recipient, tokenId);

        assertEq(childMintableERC721.ownerOf(1337), recipient);
    }
}
