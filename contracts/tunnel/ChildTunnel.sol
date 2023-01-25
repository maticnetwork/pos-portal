pragma solidity 0.6.6;

import {BaseChildTunnel} from "./BaseChildTunnel.sol";


contract ChildTunnel is BaseChildTunnel {
    function _processMessageFromRoot(bytes memory message) internal override {
      // you can implement custom message processing logic here
    }
}
