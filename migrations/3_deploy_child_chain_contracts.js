const ChildChainManager = artifacts.require('ChildChainManager')
const ChildToken = artifacts.require('ChildToken')
const ETH = artifacts.require('ETH')
const utils = require('./utils')

module.exports = async(deployer) => {
  await deployer.deploy(ChildChainManager)
  await deployer.deploy(ChildToken, 'Dummy Child Token', 'DUMMY', 18)
  await deployer.deploy(ETH)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.child.ChildChainManager = ChildChainManager.address
  contractAddresses.child.DummyToken = ChildToken.address
  contractAddresses.child.ETH = ETH.address
  utils.writeContractAddresses(contractAddresses)
}
