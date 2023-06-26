// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {ChildMintableERC20} from "contracts/child/ChildToken/ChildMintableERC20.sol";

contract ChildMintableERC20Test is Test, NMTHelpers {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    ChildMintableERC20 internal childMintableERC20;

    Account internal signer;
    address internal childChainManagerAddr;

    bytes internal revertMsg = "ChildMintableERC20: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");

        childMintableERC20 = new ChildMintableERC20(
            "Name",
            "Symbol",
            18,
            childChainManagerAddr
        );

        signer = makeAccount("signer");
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            childMintableERC20.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );

        vm.expectEmit();
        emit RoleGranted(
            childMintableERC20.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        childMintableERC20 = new ChildMintableERC20(
            "Name",
            "Symbol",
            18,
            childChainManagerAddr
        );

        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("Name")),
                keccak256(bytes(childMintableERC20.ERC712_VERSION())),
                address(childMintableERC20),
                bytes32(childMintableERC20.getChainId())
            )
        );

        assertEq(childMintableERC20.name(), "Name");
        assertEq(childMintableERC20.symbol(), "Symbol");
        assertEq(uint256(childMintableERC20.decimals()), 18);
        assertEq(
            childMintableERC20.getDomainSeperator(),
            expectedDomainSeperator
        );
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childMintableERC20.deposit(address(0), "");
    }

    function testDeposit() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1337e18;
        uint256 totalSupply = childMintableERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit Transfer(address(0), recipient, amount);

        childMintableERC20.deposit(recipient, abi.encode(amount));

        assertEq(childMintableERC20.balanceOf(recipient), amount);
        assertEq(childMintableERC20.totalSupply(), totalSupply + amount);
    }

    function testWithdraw() public {
        Account memory burner = makeAccount("burner");
        uint256 startingAmount = 1337e18;
        uint256 amountToWithdraw = 1e18;
        uint256 totalSupply = childMintableERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        childMintableERC20.deposit(burner.addr, abi.encode(startingAmount));

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit Transfer(burner.addr, address(0), amountToWithdraw);

        executeMetaTransaction(
            address(childMintableERC20),
            abi.encodeWithSelector(
                childMintableERC20.withdraw.selector,
                amountToWithdraw
            ),
            burner
        );

        assertEq(
            childMintableERC20.balanceOf(burner.addr),
            startingAmount - amountToWithdraw
        );
        assertEq(
            childMintableERC20.totalSupply(),
            totalSupply + startingAmount - amountToWithdraw
        );
    }

    function testCannotMint_OnlyAdmin() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        childMintableERC20.deposit(address(0), "");
    }

    function testMint() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1337e18;
        uint256 totalSupply = childMintableERC20.totalSupply();

        vm.expectEmit();
        emit Transfer(address(0), recipient, amount);

        childMintableERC20.mint(recipient, amount);

        assertEq(childMintableERC20.balanceOf(recipient), amount);
        assertEq(childMintableERC20.totalSupply(), totalSupply + amount);
    }
}
