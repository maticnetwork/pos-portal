const ChildChainManager = artifacts.require('ChildChainManager')
const ChildToken = artifacts.require('ChildToken')
const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')

module.exports = async(deployer) => {
  await deployer.deploy(ChildChainManager)
  await deployer.deploy(ChildToken, 'Dummy Child Token', 'DUMMY', 18)
  await deployer.deploy(MaticWETH)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.child.ChildChainManager = ChildChainManager.address
  contractAddresses.child.DummyToken = ChildToken.address
  contractAddresses.child.MaticWETH = MaticWETH.address
  utils.writeContractAddresses(contractAddresses)
}
