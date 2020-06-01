pragma solidity ^0.6.6;

import { RootChainManagerStorage } from "./RootChainManagerStorage.sol";
import { Proxy } from "../../common/Proxy/Proxy.sol";


contract RootChainManagerProxy is Proxy, RootChainManagerStorage {
    constructor(address _proxyTo)
        public
        Proxy(_proxyTo)
    {}

    function updateImplementation(address _newProxyTo) public override only(DEFAULT_ADMIN_ROLE) {
        super.updateImplementation(_newProxyTo);
    }
}
