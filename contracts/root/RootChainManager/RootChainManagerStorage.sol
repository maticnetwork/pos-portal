pragma solidity ^0.6.6;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ProxyStorage} from "../../common/Proxy/ProxyStorage.sol";

contract RootChainManagerStorage is ProxyStorage, AccessControl {
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
    bytes32 public constant REGISTERER_ROLE = keccak256("REGISTERER_ROLE");

    // maybe typeToPredicate can be reduced to bytes4
    mapping(bytes32 => address) internal _typeToPredicate;
    mapping(address => address) internal _rootToChildToken;
    mapping(address => address) internal _childToRootToken;
    mapping(address => bytes32) internal _tokenToType;
    mapping(bytes32 => bool) internal _processedExits;

    modifier only(bytes32 role) {
        require(
            hasRole(role, _msgSender()),
            "RootChainManager: INSUFFICIENT_PERMISSIONS"
        );
        _;
    }
}
