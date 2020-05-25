pragma solidity >=0.4.21 <0.7.0;

contract EIP712Base {
  struct EIP712Domain {
    string name;
    string version;
    address verifyingContract;
    bytes32 salt;
  }

  bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(bytes("EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"));
  bytes32 internal domainSeperator;
  uint public chainId;

  constructor(string memory _name, string memory _version, uint256 _chainId) public {
    domainSeperator = keccak256(abi.encode(
      EIP712_DOMAIN_TYPEHASH,
      keccak256(bytes(_name)),
      keccak256(bytes(_version)),
      address(this),
      getSalt(_chainId)
    ));
    chainId = _chainId;
  }

  function getSalt(uint _chainId) public pure returns (bytes32 salt) {
    salt = keccak256(abi.encode(_chainId));
  }

  function getDomainSeperator() private view returns(bytes32) {
    return domainSeperator;
  }

  /**
  * Accept message hash and returns hash message in EIP712 compatible form
  * So that it can be used to recover signer from signature signed using EIP712 formatted data
  * https://eips.ethereum.org/EIPS/eip-712
  * "\\x19" makes the encoding deterministic
  * "\\x01" is the version byte to make it compatible to EIP-191
  */
  function toTypedMessageHash(bytes32 messageHash) internal view returns(bytes32) {
    return keccak256(abi.encodePacked("\x19\x01", getDomainSeperator(), messageHash));
  }
}
