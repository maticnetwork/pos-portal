// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import {UpdateImplementationTimelock} from "scripts/forge/update-impl-timelock/UpdateImplementationTimelock.s.sol";

contract RootChainManagerUpdate is UpdateImplementationTimelock {
    string internal constant CONTRACT_NAME = "RootChainManager";

    function run() public override returns (address, bytes memory, bytes memory, bytes32) {
        contractName = CONTRACT_NAME;
        return super.run();
    }
}
