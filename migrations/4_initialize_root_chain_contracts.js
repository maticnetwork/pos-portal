const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const ERC20Predicate = artifacts.require('ERC20Predicate')
// const WETH = artifacts.require('WETH')
const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()

  console.log('Deploying RootChainManagerProxy')
  await deployer.deploy(RootChainManagerProxy, contractAddresses.root.RootChainManager)
  contractAddresses.root.RootChainManagerProxy = RootChainManagerProxy.address
  utils.writeContractAddresses(contractAddresses)

  const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)
  const ERC20PredicateInstance = await ERC20Predicate.at(contractAddresses.root.ERC20Predicate)
  // const WETHContract = await WETH.at(contractAddresses.root.WETH)

  console.log('Setting StateSender')
  await RootChainManagerInstance.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)

  // console.log('Setting WETH')
  // await RootChainManagerContract.setWETH(contractAddresses.root.WETH)

  console.log('Setting CheckpointManager')
  await RootChainManagerInstance.setCheckpointManager(config.plasmaRootChain)

  console.log('Register ERC20Predicate')
  const ERC20 = await ERC20PredicateInstance.tokenType()
  await RootChainManagerInstance.registerPredicate(ERC20, contractAddresses.root.ERC20Predicate)

  console.log('Mapping DummyToken')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken, ERC20)

  // console.log('Mapping WETH')
  // await RootChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.MaticWETH)

  // console.log('Granting ROOT_CHAIN_MANAGER_ROLE on WETH')
  // const ROOT_CHAIN_MANAGER_ROLE = await WETHContract.ROOT_CHAIN_MANAGER_ROLE()
  // await WETHContract.grantRole(ROOT_CHAIN_MANAGER_ROLE, contractAddresses.root.RootChainManager)
}
