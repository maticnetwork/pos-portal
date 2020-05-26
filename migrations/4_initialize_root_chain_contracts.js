const RootChainManager = artifacts.require('RootChainManager')
const WETH = artifacts.require('WETH')
const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()
  const RootChainManagerContract = await RootChainManager.at(contractAddresses.root.RootChainManager)
  const WETHContract = await WETH.at(contractAddresses.root.WETH)

  await RootChainManagerContract.setStateSender(contractAddresses.root.DummyStateSender)
  await RootChainManagerContract.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)
  await RootChainManagerContract.setWETH(contractAddresses.root.WETH)
  await RootChainManagerContract.setCheckpointManager(config.plasmaRootChain)
  await RootChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)
  await RootChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.ETH)

  const ROOT_CHAIN_MANAGER_ROLE = await WETHContract.ROOT_CHAIN_MANAGER_ROLE()
  await WETHContract.grantRole(ROOT_CHAIN_MANAGER_ROLE, contractAddresses.root.RootChainManager)
}
