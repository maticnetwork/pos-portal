// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Singleton - Base for singleton contracts (should always be the first super contract)
 *        This contract is tightly coupled to our proxy contract (see `proxies/SafeProxy.sol`)
 * @author Richard Meissner - @rmeissner
 */
abstract contract Singleton {
    // singleton always has to be the first declared variable to ensure the same location as in the Proxy contract.
    // It should also always be ensured the address is stored alone (uses a full word)
    address private singleton;
}
