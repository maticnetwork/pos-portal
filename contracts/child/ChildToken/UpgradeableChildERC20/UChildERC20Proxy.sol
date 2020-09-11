pragma solidity 0.6.6;

import {UpgradableProxy} from "../../../common/Proxy/UpgradableProxy.sol";

contract UChildERC20Proxy is UpgradableProxy {
    constructor(address _proxyTo)
        public
        UpgradableProxy(_proxyTo)
    {}
}
