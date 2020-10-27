pragma solidity 0.6.6;

import {UChildERC20} from "../UpgradeableChildERC20/UChildERC20.sol";

contract UChildDAI is UChildERC20 {
    // bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
    bytes32 public constant PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;

    // --- Alias ---
    function push(address usr, uint wad) external {
        transferFrom(msg.sender, usr, wad);
    }
    function pull(address usr, uint wad) external {
        transferFrom(usr, msg.sender, wad);
    }
    function move(address src, address dst, uint wad) external {
        transferFrom(src, dst, wad);
    }

    // --- Approve by signature ---
    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                getDomainSeperator(),
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,
                        holder,
                        spender,
                        nonce,
                        expiry,
                        allowed
                    )
                )
        ));

        require(holder == ecrecover(digest, v, r, s), "UChildDAI: INVALID-PERMIT");
        require(expiry == 0 || now <= expiry, "UChildDAI: PERMIT-EXPIRED");
        require(nonce == nonces[holder]++, "UChildDAI: INVALID-NONCE");
        require(msg.sender != address(this), "UChildDAI: PERMIT_META_TX_DISABLED");
        uint wad = allowed ? uint(-1) : 0;
        _approve(holder, spender, wad);
    }
}
