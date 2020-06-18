pragma solidity ^0.6.6;
import {IERCProxy} from "./IERCProxy.sol";
import {ProxyStorage} from "./ProxyStorage.sol";

contract Proxy is ProxyStorage, IERCProxy {
    event ProxyUpdated(address indexed _new, address indexed _old);
    event OwnerUpdate(address _prevOwner, address _newOwner);

    fallback() external virtual payable {
        delegatedFwd(proxyTo, msg.data);
    }

    receive() external virtual payable {
        delegatedFwd(proxyTo, msg.data);
    }

    function delegatedFwd(address _dst, bytes memory _calldata) internal {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let result := delegatecall(
                sub(gas(), 10000),
                _dst,
                add(_calldata, 0x20),
                mload(_calldata),
                0,
                0
            )
            let size := returndatasize()

            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)

            // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
            // if the call returned error data, forward it
            switch result
                case 0 {
                    revert(ptr, size)
                }
                default {
                    return(ptr, size)
                }
        }
    }

    function proxyType() external virtual override pure returns (uint256 proxyTypeId) {
        // Upgradeable proxy
        proxyTypeId = 2;
    }

    function implementation() external virtual override view returns (address) {
        return proxyTo;
    }

    // function _updateImplementation(address _newProxyTo) internal virtual {
    //     require(_newProxyTo != address(0x0), "INVALID_PROXY_ADDRESS");
    //     require(
    //         isContract(_newProxyTo),
    //         "DESTINATION_ADDRESS_IS_NOT_A_CONTRACT"
    //     );
    //     emit ProxyUpdated(_newProxyTo, proxyTo);
    //     proxyTo = _newProxyTo;
    // }

    // function isContract(address _target) internal view returns (bool) {
    //     if (_target == address(0)) {
    //         return false;
    //     }

    //     uint256 size;
    //     assembly {
    //         size := extcodesize(_target)
    //     }
    //     return size > 0;
    // }
}
