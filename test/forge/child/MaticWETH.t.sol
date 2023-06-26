// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {MaticWETH} from "contracts/child/ChildToken/MaticWETH.sol";

contract MaticWETHTest is Test {
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    address internal childChainManagerAddr;
    MaticWETH internal maticWETH;

    function setUp() public {
        childChainManagerAddr = makeAddr("childChainManagerAddr");
        maticWETH = new MaticWETH(childChainManagerAddr);
    }

    function testConstructor() public {
        vm.expectEmit();
        emit RoleGranted(
            maticWETH.DEFAULT_ADMIN_ROLE(),
            address(this),
            address(this)
        );
        vm.expectEmit();
        emit RoleGranted(
            maticWETH.DEPOSITOR_ROLE(),
            childChainManagerAddr,
            address(this)
        );

        maticWETH = new MaticWETH(childChainManagerAddr);

        assertEq(maticWETH.name(), "Wrapped Ether");
        assertEq(maticWETH.symbol(), "WETH");
        assertEq(uint256(maticWETH.decimals()), 18);
    }
}
