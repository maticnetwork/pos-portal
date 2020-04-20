const RootChainManager = artifacts.require('RootChainManager')
const DummyStateSender = artifacts.require('DummyStateSender')
const DummyToken = artifacts.require('DummyToken')
const utils = require('./utils')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()
  const RootChainManagerContract = await RootChainManager.at(contractAddresses.root.RootChainManager)
  await RootChainManagerContract.setStateSender(contractAddresses.root.DummyStateSender)
  await RootChainManagerContract.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)
  await RootChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)
}
