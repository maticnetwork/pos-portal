export const getTypedData = ({ name, version, chainId, verifyingContract, nonce, from, functionSignature }) => {
  return {
    types: {
      EIP712Domain: [{
        name: 'name',
        type: 'string'
      }, {
        name: 'version',
        type: 'string'
      }, {
        name: 'chainId',
        type: 'uint256'
      }, {
        name: 'verifyingContract',
        type: 'address'
      }],
      MetaTransaction: [{
        name: 'nonce',
        type: 'uint256'
      }, {
        name: 'from',
        type: 'address'
      }, {
        name: 'functionSignature',
        type: 'bytes'
      }]
    },
    domain: {
      name,
      version,
      chainId,
      verifyingContract
    },
    primaryType: 'MetaTransaction',
    message: {
      nonce,
      from,
      functionSignature
    }
  }
}
