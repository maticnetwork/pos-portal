// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {ChildERC721} from "contracts/child/ChildToken/ChildERC721.sol";

contract ChildERC721Test is Test, NMTHelpers {
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

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    ChildERC721 internal childERC721;

    Account internal signer;
    address internal childChainManagerAddr;

    bytes internal revertMsg = "ChildERC721: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");

        childERC721 = new ChildERC721("Name", "Symbol", childChainManagerAddr);

        signer = makeAccount("signer");
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            childERC721.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childERC721.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        childERC721 = new ChildERC721("Name", "Symbol", childChainManagerAddr);

        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("Name")),
                keccak256(bytes(childERC721.ERC712_VERSION())),
                address(childERC721),
                bytes32(childERC721.getChainId())
            )
        );

        assertEq(childERC721.name(), "Name");
        assertEq(childERC721.symbol(), "Symbol");
        assertEq(childERC721.getDomainSeperator(), expectedDomainSeperator);
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childERC721.deposit(address(0), "");
    }

    function testDeposit_Single() public {
        address recipient = makeAddr("recipient");
        uint256 tokenId = 1337;

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit Transfer(address(0), recipient, tokenId);

        childERC721.deposit(recipient, abi.encode(tokenId));

        assertEq(childERC721.ownerOf(1337), recipient);
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

        childERC721.deposit(recipient, abi.encode(tokenIds));

        for (uint256 i; i < tokenIds.length; ++i) {
            assertEq(childERC721.ownerOf(tokenIds[i]), recipient);
        }
    }

    function testCannotWithdraw_InvalidOwner() public {
        vm.prank(childChainManagerAddr);
        childERC721.deposit(signer.addr, abi.encode(1337));

        vm.prank(ALIEN);

        vm.expectRevert("ChildERC721: INVALID_TOKEN_OWNER");

        childERC721.withdraw(1337);
    }

    function testWithdraw() public {
        uint256 tokenId = 1337;

        vm.prank(childChainManagerAddr);
        childERC721.deposit(signer.addr, abi.encode(tokenId));

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit Transfer(signer.addr, address(0), tokenId);

        executeMetaTransaction(
            address(childERC721),
            abi.encodeWithSelector(childERC721.withdraw.selector, tokenId),
            signer
        );
    }

    function testCannotWithdrawBatch_ExceedsBatchLimit() public {
        uint256[] memory tokenIds = new uint256[](
            childERC721.BATCH_LIMIT() + 1
        );

        vm.expectRevert("ChildERC721: EXCEEDS_BATCH_LIMIT");

        childERC721.withdrawBatch(tokenIds);
    }

    function testCannotWithdrawBatch_InvalidOwner() public {
        vm.startPrank(childChainManagerAddr);
        childERC721.deposit(address(this), abi.encode(1337));
        childERC721.deposit(makeAddr("random"), abi.encode(1338));
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;

        // gibberish (token id was not converted to string before concatenation)
        vm.expectRevert(
            abi.encodePacked("ChildERC721: INVALID_TOKEN_OWNER ", uint256(1338))
        );

        childERC721.withdrawBatch(tokenIds);
    }

    function testWithdrawBatch() public {
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;
        tokenIds[2] = 1339;

        vm.prank(childChainManagerAddr);
        childERC721.deposit(signer.addr, abi.encode(tokenIds));

        skipMetaTransactionEvent();

        for (uint256 i; i < tokenIds.length; ++i) {
            vm.expectEmit();
            emit Transfer(signer.addr, address(0), tokenIds[i]);
        }

        vm.expectEmit();
        emit WithdrawnBatch(signer.addr, tokenIds);

        executeMetaTransaction(
            address(childERC721),
            abi.encodeWithSelector(
                childERC721.withdrawBatch.selector,
                tokenIds
            ),
            signer
        );
    }
}
