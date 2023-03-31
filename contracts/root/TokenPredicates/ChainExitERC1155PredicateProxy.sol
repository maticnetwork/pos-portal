// +-----------------------------------------+
// |                                         |
// |     DEPRECATION NOTICE                  |
// |     This contract is deprecated and     |
// |     will not be supported.              |
// |                                         |
// +-----------------------------------------+
pragma solidity 0.6.6;

import {UpgradableProxy} from "../../common/Proxy/UpgradableProxy.sol";

contract ChainExitERC1155PredicateProxy is UpgradableProxy {
    constructor(address _proxyTo)
        public
        UpgradableProxy(_proxyTo)
    {}
}
