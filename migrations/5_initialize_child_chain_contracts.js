const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const DummyChildToken = artifacts.require('ChildToken')
// const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()

  console.log('Deploying ChildChainManagerProxy')
  await deployer.deploy(ChildChainManagerProxy, contractAddresses.child.ChildChainManager)
  contractAddresses.child.ChildChainManagerProxy = ChildChainManagerProxy.address
  utils.writeContractAddresses(contractAddresses)

  const ChildChainManagerInstance = await ChildChainManager.at(contractAddresses.child.ChildChainManagerProxy)

  console.log('Granting STATE_SYNCER_ROLE on ChildChainManager')
  const STATE_SYNCER_ROLE = await ChildChainManagerInstance.STATE_SYNCER_ROLE()
  await ChildChainManagerInstance.grantRole(STATE_SYNCER_ROLE, config.stateReceiver)

  console.log('Mapping DummyToken')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)

  console.log('Setting rootToken of DummyToken')
  const DummyChildTokenInstance = await DummyChildToken.at(contractAddresses.child.DummyToken)
  await DummyChildTokenInstance.setRootToken(contractAddresses.root.DummyToken)

  console.log('Granting DEPOSITOR_ROLE on ChildChainManager')
  const DEPOSITOR_ROLE = await DummyChildTokenInstance.DEPOSITOR_ROLE()
  await DummyChildTokenInstance.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManagerProxy)

  // console.log('Mapping WETH')
  // await ChildChainManagerInstance.mapToken(contractAddresses.root.WETH, contractAddresses.child.MaticWETH)

  // console.log('Setting rootToken of MaticWETH')
  // const MaticWETHInstance = await MaticWETH.at(contractAddresses.child.MaticWETH)
  // await MaticWETHInstance.setRootToken(contractAddresses.root.WETH)

  // console.log('Granting DEPOSITOR_ROLE on MaticWETH')
  // await MaticWETHInstance.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManagerProxy)
}
