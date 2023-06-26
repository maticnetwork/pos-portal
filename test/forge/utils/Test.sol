// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

// 💬 ABOUT
// Custom Test.

// 🧩 MODULES
import {console2 as console} from "forge-std/console2.sol";
import {StdAssertions} from "forge-std/StdAssertions.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {stdError} from "forge-std/StdError.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Vm} from "forge-std/Vm.sol";

// 📦 BOILERPLATE
import {TestBase} from "forge-std/Base.sol";
import {DSTest} from "ds-test/test.sol";

// ⭐️ TEST
abstract contract Test is DSTest, StdAssertions, StdCheats, StdUtils, TestBase {

}
