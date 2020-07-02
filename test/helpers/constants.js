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
