const ChildChainManager = artifacts.require('ChildChainManager')
const ChildToken = artifacts.require('ChildToken')
const utils = require('./utils')

module.exports = async(deployer) => {
  await deployer.deploy(ChildChainManager)
  await deployer.deploy(ChildToken, 'Dummy Child Token', 'DUMMY', 18)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.child.ChildChainManager = ChildChainManager.address
  contractAddresses.child.ChildToken = ChildToken.address
  utils.writeContractAddresses(contractAddresses)
}
