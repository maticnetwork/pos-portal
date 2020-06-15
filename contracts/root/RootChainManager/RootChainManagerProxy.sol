pragma solidity ^0.6.6;

import {RootChainManagerStorage} from "./RootChainManagerStorage.sol";
import {Proxy} from "../../common/Proxy/Proxy.sol";

contract RootChainManagerProxy is Proxy, RootChainManagerStorage {
    constructor(address _proxyTo)
        public
        RootChainManagerStorage()
        Proxy(_proxyTo)
    {}

    function updateImplementation(address _newProxyTo)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _updateImplementation(_newProxyTo);
    }
}
