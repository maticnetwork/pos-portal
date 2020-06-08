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

  const RootChainManagerContract = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)
  const WETHContract = await WETH.at(contractAddresses.root.WETH)

  console.log('Setting StateSender')
  await RootChainManagerContract.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerContract.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)

  console.log('Setting WETH')
  await RootChainManagerContract.setWETH(contractAddresses.root.WETH)

  console.log('Setting CheckpointManager')
  await RootChainManagerContract.setCheckpointManager(config.plasmaRootChain)

  console.log('Mapping DummyToken')
  await RootChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)

  console.log('Mapping WETH')
  await RootChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.MaticWETH)

  console.log('Granting ROOT_CHAIN_MANAGER_ROLE on WETH')
  const ROOT_CHAIN_MANAGER_ROLE = await WETHContract.ROOT_CHAIN_MANAGER_ROLE()
  await WETHContract.grantRole(ROOT_CHAIN_MANAGER_ROLE, contractAddresses.root.RootChainManager)
}
