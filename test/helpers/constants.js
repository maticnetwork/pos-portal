import BN from 'bn.js'

// export const rootRPC = 'http://localhost:8545'
// export const childRPC = 'http://localhost:9545'

// export const rootWeb3 = new web3.constructor(
//   new web3.providers.HttpProvider(rootRPC)
// )
// export const childWeb3 = new web3.constructor(
//   new web3.providers.HttpProvider(childRPC)
// )

export const rootRPC = 'http://localhost:9545'
export const childRPC = 'http://localhost:8545'

export const etherAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const erc20TransferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const erc721TransferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const erc721WithdrawnBatchEventSig = '0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df'
export const erc721TransferWithMetadataEventSig = '0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14'
export const erc1155TransferSingleEventSig = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
export const erc1155TransferBatchEventSig = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
export const erc1155ChainExitEventSig = '0xc7b80b68f1c661da97dbd7e6e143a0c7c587dfc522cb2ac508b9084fecc492bc'

export const mockValues = {
  zeroAddress: '0x0000000000000000000000000000000000000000',
  addresses: [
    '0x40De196d3c406242A4157290FE2641433C3abC73',
    '0xEDC5f296a70096EB49f55681237437cbd249217A',
    '0x25d7981811EB756F988b264004d42de2b6aB8c9D',
    '0x3D850881A6dcCB4bF762e49508531da68e14706C',
    '0xcfb14dD525b407e6123EE3C88B7aB20963892a66',
    '0xB8D0Cbd4bC841D6fbA36CE0e0ED770aC45A261b2',
    '0x6EF439c004dE0598472D9352Cc04DA65B249BDb4',
    '0x32F303BB2Ca9167e9287CB0f53557D249D3D24BF',
    '0xd7728112027c0d2A67c097BcF5D71adF96C9c858',
    '0x48c856F10d5930DaE3CF338173247aB8DA94d308'
  ],
  bytes32: [
    '0x9bb1e484529be7ac2ab09fe9863eebe554b06bb3153c52d7e43bc0487cfc771a',
    '0xe000fcd82f21f4ec092f882c35aa0b9dcca5bb571af45e432c89a226b408fa4a',
    '0x32742d619e0bda662bd775d9d0375521c634b8dead3049a509978f1640519a76',
    '0xdac07c018b24dfc09012597ee0350a27090f33a68328157be35c255d325a8ebc',
    '0x00000000000000000000000000000000000000000000000003c68af0bb140000'
  ],
  amounts: [
    new BN('100000000000000000'),
    new BN('200000000000000000'),
    new BN('500000000000000000'),
    new BN('1000000000000000000'),
    new BN('2000000000000000000'),
    new BN('5000000000000000000'),
    new BN('10000000000000000000'),
    new BN('20000000000000000000'),
    new BN('50000000000000000000'),
    new BN('200000000000000000000')
  ],
  numbers: [
    1,
    2,
    5,
    10,
    20,
    50,
    100,
    200,
    500,
    2000
  ]
}
