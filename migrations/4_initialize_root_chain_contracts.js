const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const WETH = artifacts.require('WETH')
const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()

  console.log('Deploying RootChainManagerProxy')
  await deployer.deploy(RootChainManagerProxy, contractAddresses.root.RootChainManager)
  contractAddresses.root.RootChainManagerProxy = RootChainManagerProxy.address
  utils.writeContractAddresses(contractAddresses)

  const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)
  const WETHInstance = await WETH.at(contractAddresses.root.WETH)

  console.log('Setting StateSender')
  await RootChainManagerInstance.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManagerProxy)

  console.log('Setting WETH')
  await RootChainManagerInstance.setWETH(contractAddresses.root.WETH)

  console.log('Setting CheckpointManager')
  await RootChainManagerInstance.setCheckpointManager(config.plasmaRootChain)

  console.log('Mapping DummyToken')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)

  console.log('Mapping WETH')
  await RootChainManagerInstance.mapToken(contractAddresses.root.WETH, contractAddresses.child.MaticWETH)

  console.log('Granting ROOT_CHAIN_MANAGER_ROLE on WETH')
  const ROOT_CHAIN_MANAGER_ROLE = await WETHInstance.ROOT_CHAIN_MANAGER_ROLE()
  await WETHInstance.grantRole(ROOT_CHAIN_MANAGER_ROLE, contractAddresses.root.RootChainManagerProxy)
}
