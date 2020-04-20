export const rootRPC = 'http://localhost:8545'
export const childRPC = 'http://localhost:9545'

export const rootWeb3 = new web3.constructor(
  new web3.providers.HttpProvider(rootRPC)
)
export const childWeb3 = new web3.constructor(
  new web3.providers.HttpProvider(childRPC)
)
