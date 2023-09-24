pragma solidity 0.6.6;

import {ERC20} from "./ERC20.sol";
import {AccessControlMixin} from "../../../common/AccessControlMixin.sol";
import {IChildToken} from "../IChildToken.sol";
import {NativeMetaTransaction} from "../../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../../common/ContextMixin.sol";
import {UChildERC20} from "./UChildERC20.sol";

/**
 * @title UChildERC20Permit EIP2612
 * @author KaizenDeveloperA
 * @notice UChildERC20 template with EIP-3009 (https://eips.ethereum.org/EIPS/eip-3009)
 */
contract UChildERC20Permit is UChildERC20 {
  /// @dev  Access related state variables
  bytes32 public constant PERMIT2_REVOKER_ROLE =
    0xbd4c1461ef59750b24719a44d7e2a7948c57fd12c98e333541b7ea7b61f07cb7;
  address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
  bool public permit2Enabled;

  /// @dev Permit related state variables
  bytes32 public DOMAIN_SEPARATOR;
  bytes32 public constant PERMIT_TYPEHASH =
    0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
  event Permit2AllowanceUpdated(bool enabled);
  string internal constant PERMIT_EXPRIED = "UChildERC20Permit: permit expired";
  string internal constant INVALID_SIGNATURE =
    "UChildERC20Permit: invalid signature";

  constructor(address permit2revoker) public {
    ///  Initialize DOMAIN_SEPARATOR for EIP-712 permit
    uint256 chainId;
    assembly {
      chainId := chainid()
    }
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256(
          "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256("UChildERC20WithPermit"),
        keccak256("1"),
        chainId,
        address(this)
      )
    );
    _setupRole(PERMIT2_REVOKER_ROLE, permit2revoker);
    _updatePermit2Allowance(true);
  }

  /// @notice Manages the default max approval to the permit2 contract
  /// @param enabled If true, the permit2 contract has full approval by default, if false, it has no approval by default
  function updatePermit2Allowance(
    bool enabled
  ) external only(PERMIT2_REVOKER_ROLE) {
    _updatePermit2Allowance(enabled);
  }

  /// @notice The permit2 contract has full approval by default. If the approval is revoked, it can still be manually approved.
  function allowance(
    address owner,
    address spender
  ) public view override returns (uint256) {
    if (spender == PERMIT2 && permit2Enabled) return uint256(-1);
    return super.allowance(owner, spender);
  }

  /**
   * @dev Sets `value` as the allowance of `spender` over ``owner``'s tokens,
   * given ``owner``'s signed approval.
   *
   *
   * Emits an {Approval} event.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   * - `deadline` must be a timestamp in the future.
   * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
   * over the EIP712-formatted function arguments.
   * - the signature must use ``owner``'s current nonce (see {nonces}).
   *
   * For more information on the signature format, see the
   * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
   * section].
   *
   * CAUTION: See Security Considerations above.
   */
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public virtual {
    require(block.timestamp < deadline, PERMIT_EXPRIED);
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            PERMIT_TYPEHASH,
            owner,
            spender,
            value,
            ++nonces[owner],
            deadline
          )
        )
      )
    );
    address recoveredAddress = ecrecover(digest, v, r, s);
    require(
      recoveredAddress != address(0) && recoveredAddress == owner,
      INVALID_SIGNATURE
    );
    _approve(owner, spender, value);
  }

  function _updatePermit2Allowance(bool enabled) private {
    permit2Enabled = enabled;
    emit Permit2AllowanceUpdated(enabled);
  }
}
