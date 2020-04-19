const RootChainManager = artifacts.require('RootChainManager')
const DummyStateSender = artifacts.require('DummyStateSender')
const DummyToken = artifacts.require('DummyToken')
const utils = require('./utils')

module.exports = async(deployer) => {
  await deployer.deploy(RootChainManager)
  await deployer.deploy(DummyStateSender)
  await deployer.deploy(DummyToken)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.root.RootChainManager = RootChainManager.address
  contractAddresses.root.DummyStateSender = DummyStateSender.address
  contractAddresses.root.DummyToken = DummyToken.address
  utils.writeContractAddresses(contractAddresses)
}
