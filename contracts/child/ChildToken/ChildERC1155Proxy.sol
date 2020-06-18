pragma solidity ^0.6.6;

import {UpgradableProxy} from "../../common/Proxy/UpgradableProxy.sol";

contract ChildERC1155Proxy is UpgradableProxy {
    constructor(address _proxyTo)
        public
        UpgradableProxy(_proxyTo)
    {}
}
