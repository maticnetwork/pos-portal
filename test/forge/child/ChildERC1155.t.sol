// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {ChildERC1155} from "contracts/child/ChildToken/ChildERC1155.sol";

contract ChildERC1155Test is Test, NMTHelpers {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    ChildERC1155 internal childERC1155;

    Account internal signer;
    address internal childChainManagerAddr;

    bytes internal revertMsg = "ChildERC1155: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");

        childERC1155 = new ChildERC1155("uri", childChainManagerAddr);

        signer = makeAccount("signer");
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            childERC1155.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childERC1155.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        childERC1155 = new ChildERC1155("uri", childChainManagerAddr);

        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("uri")),
                keccak256(bytes(childERC1155.ERC712_VERSION())),
                address(childERC1155),
                bytes32(childERC1155.getChainId())
            )
        );

        assertEq(childERC1155.uri(0), "uri");
        assertEq(childERC1155.getDomainSeperator(), expectedDomainSeperator);
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childERC1155.deposit(address(0), "");
    }

    function testCannotDeposit_InvalidUser() public {
        uint256[] memory tokenIds = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);

        vm.prank(childChainManagerAddr);

        vm.expectRevert("ChildERC1155: INVALID_DEPOSIT_USER");

        childERC1155.deposit(
            address(0),
            abi.encode(tokenIds, amounts, bytes(""))
        );
    }

    function testDeposit() public {
        address recipient = makeAddr("recipient");
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;
        tokenIds[2] = 1337; // test addition
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 10;
        amounts[2] = 100;

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit TransferBatch(
            childChainManagerAddr,
            address(0),
            recipient,
            tokenIds,
            amounts
        );

        childERC1155.deposit(
            recipient,
            abi.encode(tokenIds, amounts, bytes(""))
        );

        for (uint256 i; i < tokenIds.length; ++i) {
            assertEq(
                childERC1155.balanceOf(recipient, tokenIds[i]),
                i == 0 || i == tokenIds.length - 1
                    ? amounts[0] + amounts[tokenIds.length - 1]
                    : amounts[i]
            );
        }
    }

    function testWithdrawSingle() public {
        Account memory burner = makeAccount("burner");
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1337;
        uint256[] memory startingAmounts = new uint256[](1);
        startingAmounts[0] = 100;
        uint256[] memory amountsToWithdraw = new uint256[](1);
        amountsToWithdraw[0] = 1;

        vm.prank(childChainManagerAddr);

        childERC1155.deposit(
            burner.addr,
            abi.encode(tokenIds, startingAmounts, bytes(""))
        );

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit TransferSingle(
            burner.addr,
            burner.addr,
            address(0),
            tokenIds[0],
            amountsToWithdraw[0]
        );

        executeMetaTransaction(
            address(childERC1155),
            abi.encodeWithSelector(
                childERC1155.withdrawSingle.selector,
                tokenIds[0],
                amountsToWithdraw[0]
            ),
            burner
        );

        assertEq(
            childERC1155.balanceOf(burner.addr, tokenIds[0]),
            startingAmounts[0] - amountsToWithdraw[0]
        );
    }

    function testWithdrawBatch() public {
        Account memory burner = makeAccount("burner");
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1337;
        tokenIds[1] = 1338;
        uint256[] memory startingAmounts = new uint256[](2);
        startingAmounts[0] = 10;
        startingAmounts[1] = 100;
        uint256[] memory amountsToWithdraw = new uint256[](2);
        amountsToWithdraw[0] = 1;
        amountsToWithdraw[1] = 2;

        vm.prank(childChainManagerAddr);

        childERC1155.deposit(
            burner.addr,
            abi.encode(tokenIds, startingAmounts, bytes(""))
        );

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit TransferBatch(
            burner.addr,
            burner.addr,
            address(0),
            tokenIds,
            amountsToWithdraw
        );

        executeMetaTransaction(
            address(childERC1155),
            abi.encodeWithSelector(
                childERC1155.withdrawBatch.selector,
                tokenIds,
                amountsToWithdraw
            ),
            burner
        );

        for (uint256 i; i < tokenIds.length; ++i) {
            assertEq(
                childERC1155.balanceOf(burner.addr, tokenIds[i]),
                startingAmounts[i] - amountsToWithdraw[i]
            );
        }
    }
}
