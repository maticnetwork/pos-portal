const RootChainManager = artifacts.require('RootChainManager')
const utils = require('./utils')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()
  const RootChainManagerContract = await RootChainManager.at(contractAddresses.root.RootChainManager)
  await RootChainManagerContract.setStateSender(contractAddresses.root.DummyStateSender)
  await RootChainManagerContract.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)
  await RootChainManagerContract.setWETH(contractAddresses.root.WETH)
  await RootChainManagerContract.setCheckpointManager('0x49d340e0a228b0BDE7B4C26a47D722D516584238')
  await RootChainManagerContract.mapToken(contractAddresses.root.DummyToken, contractAddresses.child.DummyToken)
  await RootChainManagerContract.mapToken(contractAddresses.root.WETH, contractAddresses.child.ETH)
}
