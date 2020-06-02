pragma solidity ^0.6.6;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract ChildChainManagerStorage is AccessControl {
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

    mapping(address => address) internal _rootToChildToken;
    mapping(address => address) internal _childToRootToken;

    constructor() public {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MAPPER_ROLE, _msgSender());
        _setupRole(STATE_SYNCER_ROLE, _msgSender());
    }

    modifier only(bytes32 role) {
        require(
            hasRole(role, _msgSender()),
            "ChildChainManager: INSUFFICIENT_PERMISSIONS"
        );
        _;
    }
}
