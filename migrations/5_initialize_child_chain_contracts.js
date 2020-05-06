const ChildChainManager = artifacts.require('ChildChainManager')
const DummyChildToken = artifacts.require('ChildToken')
const ETH = artifacts.require('ETH')
const utils = require('./utils')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()
  const ChildChainManagerContract = await ChildChainManager.at(contractAddresses.child.ChildChainManager)

  await ChildChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)
  const DummyChildTokenContract = await DummyChildToken.at(contractAddresses.child.DummyToken)
  await DummyChildTokenContract.setRootToken(contractAddresses.root.DummyToken)
  const DEPOSITOR_ROLE = await DummyChildTokenContract.DEPOSITOR_ROLE()
  await DummyChildTokenContract.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManager)

  await ChildChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.ETH)
  const ETHContract = await ETH.at(contractAddresses.child.ETH)
  await ETHContract.setRootToken(contractAddresses.root.WETH)
  await ETHContract.grantRole(DEPOSITOR_ROLE, contractAddresses.child.ChildChainManager)
}
