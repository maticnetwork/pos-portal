pragma solidity >=0.4.21 <0.7.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract EIP712Base {
  struct EIP712Domain {
    string name;
    string version;
    uint256 chainId;
    address verifyingContract;
  }

  bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
  bytes32 internal domainSeperator;

  constructor(string memory name, string memory version) public {
    domainSeperator = keccak256(abi.encode(
      EIP712_DOMAIN_TYPEHASH,
      keccak256(bytes(name)),
      keccak256(bytes(version)),
      getChainID(),
      address(this)
    ));
  }

  function getChainID() internal pure returns (uint256 id) {
    assembly {
      id := 3
    }
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


pragma solidity >=0.4.21 <0.7.0;
contract EIP712MetaTransaction is EIP712Base {
  using SafeMath for uint256;
  bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
    bytes(
      "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
    )
  );

  event MetaTransactionExecuted(
    address userAddress,
    address payable relayerAddress,
    bytes functionSignature
  );

  mapping(address => uint256) nonces;

  /*
    * Meta transaction structure.
    * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
    * He should call the desired function directly in that case.
    */
  struct MetaTransaction {
    uint256 nonce;
    address from;
    bytes functionSignature;
  }

  constructor(string memory name, string memory version)
    public
    EIP712Base(name, version)
  {}

  function executeMetaTransaction(
    address userAddress,
    bytes memory functionSignature,
    bytes32 sigR,
    bytes32 sigS,
    uint8 sigV
  ) public payable returns (bytes memory) {
    MetaTransaction memory metaTx = MetaTransaction({
      nonce: nonces[userAddress],
      from: userAddress,
      functionSignature: functionSignature
    });
    require(
      verify(userAddress, metaTx, sigR, sigS, sigV),
      "Signer and signature do not match"
    );
    // Append userAddress and relayer address at the end to extract it from calling context
    (bool success, bytes memory returnData) = address(this).call(
      abi.encodePacked(functionSignature, userAddress, msg.sender)
    );
    require(success, "Function call not successfull");
    nonces[userAddress] = nonces[userAddress].add(1);
    emit MetaTransactionExecuted(
      userAddress,
      msg.sender,
      functionSignature
    );
    return returnData;
  }

  function hashMetaTransaction(MetaTransaction memory metaTx)
    internal
    pure
    returns (bytes32)
  {
    return
      keccak256(
        abi.encode(
          META_TRANSACTION_TYPEHASH,
          metaTx.nonce,
          metaTx.from,
          keccak256(metaTx.functionSignature)
        )
      );
  }

  function getNonce(address user) public view returns (uint256 nonce) {
    nonce = nonces[user];
  }

  function verify(
    address signer,
    MetaTransaction memory metaTx,
    bytes32 sigR,
    bytes32 sigS,
    uint8 sigV
  ) internal view returns (bool) {
    return
      signer ==
      ecrecover(
        toTypedMessageHash(hashMetaTransaction(metaTx)),
        sigV,
        sigR,
        sigS
      );
  }

  // To recieve ether in contract
  fallback() external payable {}
}
