// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";
import {NMTHelpers} from "test/forge/child/utils/NMTHelpers.sol";

import {UChildERC20} from "contracts/child/ChildToken/UpgradeableChildERC20/UChildERC20.sol";

abstract contract UninitializedState is Test, NMTHelpers {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    UChildERC20 internal uChildERC20;

    Account internal signer;
    address internal childChainManagerAddr;

    function setUp() public virtual {
        uChildERC20 = new UChildERC20();
        signer = makeAccount("signer");
        childChainManagerAddr = makeAddr("childChainManagerAddr");
    }
}

contract UChildERC20Test_Uninitialized is UninitializedState {
    function testConstructor() public {
        assertEq(uChildERC20.name(), "");
        assertEq(uChildERC20.symbol(), "");
    }

    function testInitialize() public {
        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("Name")),
                keccak256(bytes(uChildERC20.ERC712_VERSION())),
                address(uChildERC20),
                bytes32(uChildERC20.getChainId())
            )
        );

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit RoleGranted(
            uChildERC20.DEFAULT_ADMIN_ROLE(),
            signer.addr,
            signer.addr
        );

        vm.expectEmit();
        emit RoleGranted(
            uChildERC20.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            signer.addr
        );

        executeMetaTransaction(
            address(uChildERC20),
            abi.encodeWithSelector(
                uChildERC20.initialize.selector,
                "Name",
                "Symbol",
                18,
                childChainManagerAddr
            ),
            signer
        );

        assertEq(uChildERC20.name(), "Name");
        assertEq(uChildERC20.symbol(), "Symbol");
        assertEq(uint256(uChildERC20.decimals()), 18);
        assertEq(uChildERC20.getDomainSeperator(), expectedDomainSeperator);
    }
}

abstract contract InitializedState is UninitializedState {
    event Transfer(address indexed from, address indexed to, uint256 value);

    bytes internal revertMsg = "ChildSymbol: INSUFFICIENT_PERMISSIONS";

    address immutable ALIEN = makeAddr("alien");

    function setUp() public override {
        super.setUp();

        uChildERC20.initialize("Name", "Symbol", 18, childChainManagerAddr);
    }
}

contract UChildERC20Test_Initialized is InitializedState {
    function testCannotInitialize_AlreadyInited() public {
        vm.expectRevert("already inited");

        uChildERC20.initialize("Name", "Symbol", 18, childChainManagerAddr);
    }

    function testCannotChangeName_OnlyAdmin() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        uChildERC20.changeName("NewName");
    }

    function testChangeName() public {
        bytes32 expectedDomainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("NewName")),
                keccak256(bytes(uChildERC20.ERC712_VERSION())),
                address(uChildERC20),
                bytes32(uChildERC20.getChainId())
            )
        );

        uChildERC20.changeName("NewName");

        assertEq(uChildERC20.name(), "NewName");
        assertEq(uChildERC20.getDomainSeperator(), expectedDomainSeperator);
    }

    function testCannotDeposit_OnlyDepositor() public {
        vm.prank(ALIEN);

        vm.expectRevert(revertMsg);

        uChildERC20.deposit(address(0), "");
    }

    function testDeposit() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1337e18;
        uint256 totalSupply = uChildERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        vm.expectEmit();
        emit Transfer(address(0), recipient, amount);

        uChildERC20.deposit(recipient, abi.encode(amount));

        assertEq(uChildERC20.balanceOf(recipient), amount);
        assertEq(uChildERC20.totalSupply(), totalSupply + amount);
    }

    function testWithdraw() public {
        Account memory burner = makeAccount("burner");
        uint256 startingAmount = 1337e18;
        uint256 amountToWithdraw = 1e18;
        uint256 totalSupply = uChildERC20.totalSupply();

        vm.prank(childChainManagerAddr);

        uChildERC20.deposit(burner.addr, abi.encode(startingAmount));

        skipMetaTransactionEvent();

        vm.expectEmit();
        emit Transfer(burner.addr, address(0), amountToWithdraw);

        executeMetaTransaction(
            address(uChildERC20),
            abi.encodeWithSelector(
                uChildERC20.withdraw.selector,
                amountToWithdraw
            ),
            burner
        );

        assertEq(
            uChildERC20.balanceOf(burner.addr),
            startingAmount - amountToWithdraw
        );
        assertEq(
            uChildERC20.totalSupply(),
            totalSupply + startingAmount - amountToWithdraw
        );
    }
}
