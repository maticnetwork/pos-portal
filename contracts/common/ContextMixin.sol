pragma solidity 0.6.6;

/**
 * @notice DISCLAIMER:
 * Do not use NativeMetaTransaction and ContextMixin together with OpenZeppelin's "multicall"
 * nor any other form of self delegatecall!
 * Risk of address spoofing attacks.
 * Read more: https://blog.openzeppelin.com/arbitrary-address-spoofing-vulnerability-erc2771context-multicall-public-disclosure
 */

abstract contract ContextMixin {
    function msgSender()
        internal
        view
        returns (address payable sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }
}
