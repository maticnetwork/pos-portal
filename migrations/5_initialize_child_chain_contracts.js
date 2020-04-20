const ChildChainManager = artifacts.require('ChildChainManager')
const DummyChildToken = artifacts.require('ChildToken')
const utils = require('./utils')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()
  const ChildChainManagerContract = await ChildChainManager.at(contractAddresses.child.ChildChainManager)
  await ChildChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)
  const DummyChildTokenContract = await DummyChildToken.at(contractAddresses.child.DummyToken)
  await DummyChildTokenContract.setRootToken(contractAddresses.root.DummyToken)
}
