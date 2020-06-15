pragma solidity ^0.6.6;

import {ChildChainManagerStorage} from "./ChildChainManagerStorage.sol";
import {Proxy} from "../../common/Proxy/Proxy.sol";


contract ChildChainManagerProxy is Proxy, ChildChainManagerStorage {
    constructor(address _proxyTo)
        public
        ChildChainManagerStorage()
        Proxy(_proxyTo)
    {}

    function updateImplementation(address _newProxyTo)
        external
        only(DEFAULT_ADMIN_ROLE)
    {
        _updateImplementation(_newProxyTo);
    }
}
