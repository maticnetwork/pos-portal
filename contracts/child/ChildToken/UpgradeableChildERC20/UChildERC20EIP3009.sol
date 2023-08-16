pragma solidity 0.6.6;

import {UChildERC20} from "./UChildERC20.sol";
import {EIP712Base} from "../../../common/EIP712Base.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * @title UChildERC20 EIP3009
 * @author sepyke.eth
 * @notice UChildERC20 template with EIP-3009 (https://eips.ethereum.org/EIPS/eip-3009)
 */
contract UChildERC20EIP3009 is EIP712Base, UChildERC20 {
    using ECDSA for bytes32;

    /// @dev EIP3009: Transfer type hash
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = 0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;

     /// @dev EIP3009: Receive type hash
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = 0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    /// @dev EIP3009(OPTIONAL): Cancel type hash
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = 0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    /// @dev This error is raised if signature is invalid
    string internal constant SIGNATURE_INVALID = "EIP3009: invalid signature";

    /// @dev This error is raised if authorization is invalid
    string internal constant AUTHORIZATION_INVALID = "EIP3009: authorization invalid";

    /// @dev This error is raised if recipient is not executor
    string internal constant CALLER_INVALID = "EIP3009: caller must be recipient";

    /// @dev This map is used to store the authorization states
    mapping(address => mapping(bytes32 => bool)) internal _eip3009_states;

    /// @dev EIP3009: This event is emitted when authorization is used
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    /// @dev EIP3009: This event is emitted when authorization is cancelled
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    /// @dev Contract initializer
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address childChainManager
    ) override public initializer {
        _initializeEIP712(name_);
        super.initialize(name_, symbol_, decimals_, childChainManager);
    }

    /// @dev EIP3009: Validate signed transfer authorization payload
    function _checkAndUseAuthorization(
        bytes32 typeHash,
        address from,
        address to,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        require(now > validAfter, AUTHORIZATION_INVALID);
        require(now < validBefore, AUTHORIZATION_INVALID);
        require(!_eip3009_states[from][nonce], AUTHORIZATION_INVALID);

        bytes memory authorization = abi.encode(
            typeHash,
            from,
            to,
            amount,
            validAfter,
            validBefore,
            nonce
        );
        bytes32 digest = toTypedMessageHash(keccak256(authorization));
        bytes memory signature = abi.encodePacked(r,s,v);
        address signer = digest.recover(signature);
        require(signer == from, SIGNATURE_INVALID);

        _eip3009_states[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
    }

    /// @dev EIP3009: Check wethere nonce is used or not
    function authorizationState(address account, bytes32 nonce)
        external
        view
        returns (bool)
    {
        return _eip3009_states[account][nonce];
    }

    /// @dev EIP3009: Transfer with authorization signed by `from`
    function transferWithAuthorization(
        address from,
        address to,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    {
        _checkAndUseAuthorization(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s);
        _transfer(from, to, amount);
    }

    /// @dev EIP3009: Pull token from `from` with authorization signed by `from`
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    {
        require(msg.sender == to, CALLER_INVALID);
        _checkAndUseAuthorization(
            RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s);
        _transfer(from, to, amount);
    }

    /// @dev EIP3009(OPTIONAL): Revoke authorization
    function cancelAuthorization(
        address account,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(!_eip3009_states[account][nonce], AUTHORIZATION_INVALID);

        bytes memory authorization = abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH,
            account,
            nonce
        );
        bytes32 digest = toTypedMessageHash(keccak256(authorization));
        bytes memory signature = abi.encodePacked(r,s,v);
        address signer = digest.recover(signature);
        require(signer == account, SIGNATURE_INVALID);

        _eip3009_states[account][nonce] = true;
        emit AuthorizationCanceled(account, nonce);
    }

}