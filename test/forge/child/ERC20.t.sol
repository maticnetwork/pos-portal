// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";

import {ERC20} from "contracts/child/ChildToken/UpgradeableChildERC20/ERC20.sol";

contract ERC20Test is Test {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    ERC20Mock internal erc20;

    string internal name;
    string internal symbol;

    uint256 internal totalSupply;

    function setUp() public {
        name = "Name";
        symbol = "Symbol";
        erc20 = new ERC20Mock(name, symbol);

        totalSupply = 1 ether;
        erc20.exposed_mint(address(this), totalSupply);
    }

    function testConstructor() public {
        assertEq(erc20.name(), name);
        assertEq(erc20.symbol(), symbol);
        assertEq(uint256(erc20.decimals()), 18);
    }

    function testCannotMint_ToZeroAddress() public {
        vm.expectRevert("ERC20: mint to the zero address");

        erc20.exposed_mint(address(0), 0);
    }

    function testMint() public {
        uint256 amount = 0.1 ether;
        address recipient = makeAddr("recepient");

        vm.expectEmit();
        emit Transfer(address(0), recipient, amount);

        erc20.exposed_mint(recipient, amount);

        assertTrue(erc20.beforeTransferFromHookCalled());

        assertEq(erc20.totalSupply(), totalSupply + amount);
        assertEq(erc20.balanceOf(recipient), amount);

        erc20.exposed_mint(recipient, amount);

        assertEq(erc20.balanceOf(recipient), amount * 2);
    }

    function testTotalSupply() public {
        assertEq(erc20.totalSupply(), totalSupply);
    }

    function testBalanceOf() public {
        assertEq(erc20.balanceOf(address(this)), totalSupply);
    }

    function testCannotTransfer_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: transfer from the zero address");

        erc20.transfer(address(0), 0);
    }

    function testCannotTransfer_ToZeroAddress() public {
        vm.expectRevert("ERC20: transfer to the zero address");

        erc20.transfer(address(0), 0);
    }

    function testTransfer() public {
        uint256 amount = 0.1 ether;
        address recipient = makeAddr("recepient");

        vm.expectEmit();
        emit Transfer(address(this), recipient, amount);

        erc20.transfer(recipient, amount);

        assertTrue(erc20.beforeTransferFromHookCalled());

        assertEq(erc20.balanceOf(address(this)), totalSupply - amount);
        assertEq(erc20.balanceOf(recipient), amount);
    }

    function testCannotApprove_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: approve from the zero address");

        erc20.approve(address(0), 0);
    }

    function testCannotApprove_ToZeroAddress() public {
        vm.expectRevert("ERC20: approve to the zero address");

        erc20.approve(address(0), 0);
    }

    function testApprove() public {
        uint256 amount = 0.1 ether;
        address spender = makeAddr("spender");

        vm.expectEmit();
        emit Approval(address(this), spender, amount);

        erc20.approve(spender, amount);

        assertEq(erc20.allowance(address(this), spender), amount);
    }

    function testAllowance() public {
        uint256 amount = 0.1 ether;
        address spender = makeAddr("spender");

        erc20.approve(spender, amount);

        assertEq(erc20.allowance(address(this), spender), amount);
    }

    function testCannotTransferFrom_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: transfer from the zero address");

        erc20.transferFrom(address(0), address(0), 0);
    }

    function testCannotTransferFrom_ToZeroAddress() public {
        vm.expectRevert("ERC20: transfer from the zero address");

        erc20.transferFrom(address(0), address(0), 0);
    }

    function testCannotTransferFrom_AmountExceedsAllowance() public {
        vm.expectRevert("ERC20: transfer amount exceeds allowance");

        erc20.transferFrom(address(this), address(this), 1);
    }

    function testTransferFrom() public {
        uint256 approvedAmount = 1 ether;
        uint256 amount = 0.1 ether;
        address recipient = makeAddr("recepient");
        address spender = makeAddr("spender");

        erc20.approve(spender, approvedAmount);

        vm.prank(spender);

        vm.expectEmit();
        emit Approval(address(this), spender, approvedAmount - amount);

        erc20.transferFrom(address(this), recipient, amount);

        assertEq(erc20.balanceOf(address(this)), totalSupply - amount);
        assertEq(erc20.balanceOf(recipient), amount);
        assertEq(
            erc20.allowance(address(this), spender),
            approvedAmount - amount
        );
    }

    function testCannotIncreaseAllowance_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: approve from the zero address");

        erc20.increaseAllowance(address(0), 0);
    }

    function testCannotIncreaseAllowance_ToZeroAddress() public {
        vm.expectRevert("ERC20: approve to the zero address");

        erc20.increaseAllowance(address(0), 0);
    }

    function testIncreaseAllowance() public {
        address spender = makeAddr("spender");
        uint256 startingAllowance = 1 ether;

        erc20.approve(spender, startingAllowance);

        uint256 amount = 0.1 ether;

        vm.expectEmit();
        emit Approval(address(this), spender, startingAllowance + amount);

        erc20.increaseAllowance(spender, amount);

        assertEq(
            erc20.allowance(address(this), spender),
            startingAllowance + amount
        );
    }

    function testCannotDecreaseAllowance_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: approve from the zero address");

        erc20.decreaseAllowance(address(0), 0);
    }

    function testCannotDecreaseAllowance_ToZeroAddress() public {
        vm.expectRevert("ERC20: approve to the zero address");

        erc20.decreaseAllowance(address(0), 0);
    }

    function testCannotDecreaseAllowance_BelowZero() public {
        vm.expectRevert("ERC20: decreased allowance below zero");

        erc20.decreaseAllowance(address(this), 1);
    }

    function testDecreaseAllowance() public {
        address spender = makeAddr("spender");
        uint256 startingAllowance = 1 ether;

        erc20.approve(spender, startingAllowance);

        uint256 amount = 0.1 ether;

        vm.expectEmit();
        emit Approval(address(this), spender, startingAllowance - amount);

        erc20.decreaseAllowance(spender, amount);

        assertEq(
            erc20.allowance(address(this), spender),
            startingAllowance - amount
        );
    }

    function testCannotBurn_FromZeroAddress() public {
        vm.prank(address(0));

        vm.expectRevert("ERC20: burn from the zero address");

        erc20.exposed_burn(address(0), 0);
    }

    function testCannotBurn_ExceedsBalance() public {
        vm.expectRevert("ERC20: burn amount exceeds balance");

        erc20.exposed_burn(address(this), totalSupply + 1);
    }

    function testBurn() public {
        uint256 amount = 0.1 ether;

        vm.expectEmit();
        emit Transfer(address(this), address(0), amount);

        erc20.exposed_burn(address(this), amount);

        assertEq(erc20.balanceOf(address(this)), totalSupply - amount);
    }

    function testSetupDecimals() public {
        erc20.exposed_setupDecimals(0);

        assertEq(uint256(erc20.decimals()), 0);
    }
}

contract ERC20Mock is ERC20 {
    bool public beforeTransferFromHookCalled;

    constructor(
        string memory name_,
        string memory symbol_
    ) public ERC20(name_, symbol_) {}

    function exposed_mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function exposed_burn(address account, uint256 amount) external {
        _burn(account, amount);
    }

    function exposed_setupDecimals(uint8 decimals_) external {
        _setupDecimals(decimals_);
    }

    function _beforeTokenTransfer(address, address, uint256) internal override {
        beforeTransferFromHookCalled = true;
    }
}
