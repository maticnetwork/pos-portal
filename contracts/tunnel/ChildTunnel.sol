pragma solidity ^0.6.6;

import {BaseChildTunnel} from "./BaseChildTunnel.sol";


contract ChildTunnel is BaseChildTunnel {
    function processMessage(bytes memory message) override internal {
      // implement your core logic here
    }
}