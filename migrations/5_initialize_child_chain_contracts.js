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

  const ChildChainManagerContract = await ChildChainManager.at(contractAddresses.child.ChildChainManagerProxy)

  console.log('Granting STATE_SYNCER_ROLE on ChildChainManager')
  const STATE_SYNCER_ROLE = await ChildChainManagerContract.STATE_SYNCER_ROLE()
  await ChildChainManagerContract.grantRole(STATE_SYNCER_ROLE, config.stateReceiver)

  console.log('Mapping DummyToken')
  await ChildChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)

  console.log('Setting rootToken of DummyToken')
  const DummyChildTokenContract = await DummyChildToken.at(contractAddresses.child.DummyToken)
  await DummyChildTokenContract.setRootToken(contractAddresses.root.DummyToken)

  console.log('Granting DEPOSITOR_ROLE on ChildToken')
  const DEPOSITOR_ROLE = await DummyChildTokenContract.DEPOSITOR_ROLE()
  await DummyChildTokenContract.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManagerProxy)

  // console.log('Mapping WETH')
  // await ChildChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.MaticWETH)

  // console.log('Setting rootToken of MaticWETH')
  // const MaticWETHContract = await MaticWETH.at(contractAddresses.child.MaticWETH)
  // await MaticWETHContract.setRootToken(contractAddresses.root.WETH)

  // console.log('Granting DEPOSITOR_ROLE on MaticWETH')
  // await MaticWETHContract.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManager)
}
