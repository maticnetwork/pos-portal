pragma solidity ^0.6.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IChildChainManager} from "./IChildChainManager.sol";
import {IChildToken} from "../ChildToken/IChildToken.sol";
import {Initializable} from "../../common/Initializable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract ChildChainManager is IChildChainManager, Initializable, AccessControl {
    bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 public constant MAP_TOKEN = keccak256("MAP_TOKEN");
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

    mapping(address => address) internal _rootToChildToken;
    mapping(address => address) internal _childToRootToken;

    modifier only(bytes32 role) {
        require(
            hasRole(role, _msgSender()),
            "ChildChainManager: INSUFFICIENT_PERMISSIONS"
        );
        _;
    }

    function initialize(address _owner) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MAPPER_ROLE, _owner);
        _setupRole(STATE_SYNCER_ROLE, _owner);
    }

    function rootToChildToken(address rootToken)
        public
        override
        view
        returns (address)
    {
        return _rootToChildToken[rootToken];
    }

    function childToRootToken(address childToken)
        public
        override
        view
        returns (address)
    {
        return _childToRootToken[childToken];
    }

    function mapToken(address rootToken, address childToken)
        external
        override
        only(MAPPER_ROLE)
    {
        _rootToChildToken[rootToken] = childToken;
        _childToRootToken[childToken] = rootToken;
        emit TokenMapped(rootToken, childToken);
    }

    function onStateReceive(uint256, bytes calldata data)
        external
        override
        only(STATE_SYNCER_ROLE)
    {
        (bytes32 syncType, bytes memory syncData) = abi.decode(
            data,
            (bytes32, bytes)
        );

        if (syncType == DEPOSIT) {
            _syncDeposit(syncData);
        } else if (syncType == MAP_TOKEN) {
            // TODO
        }
    }

    function _syncDeposit(bytes memory syncData) private {
        (address user, address rootToken, bytes memory depositData) = abi
            .decode(syncData, (address, address, bytes));
        address childTokenAddress = _rootToChildToken[rootToken];
        require(
            childTokenAddress != address(0x0),
            "ChildChainManager: TOKEN_NOT_MAPPED"
        );
        IChildToken childTokenContract = IChildToken(childTokenAddress);
        childTokenContract.deposit(user, depositData);
    }
}
