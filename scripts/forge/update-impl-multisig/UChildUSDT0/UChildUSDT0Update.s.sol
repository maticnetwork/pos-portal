// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.29;

import {UpdateImplementationMultisig} from "scripts/forge/update-impl-multisig/UpdateImplementationMultisig.s.sol";

contract UChildUSDT0Update is UpdateImplementationMultisig {
    string internal constant CONTRACT_NAME = "UChildUSDT0";

    function run() public override returns (address, bytes memory) {
        contractName = CONTRACT_NAME;
        return super.run();
    }
}
