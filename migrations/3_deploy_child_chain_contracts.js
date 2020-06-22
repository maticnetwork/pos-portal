const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')

module.exports = async(deployer) => {
  await deployer.deploy(ChildChainManager)
  await deployer.deploy(ChildChainManagerProxy, ChildChainManager.address)
  await deployer.deploy(ChildERC20, 'Dummy ERC20', 'DERC20', 18)
  await deployer.deploy(ChildERC721, 'Dummy ERC721', 'DERC721')
  await deployer.deploy(ChildERC1155, 'Dummy ERC1155')
  await deployer.deploy(MaticWETH)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.child.ChildChainManager = ChildChainManager.address
  contractAddresses.child.ChildChainManagerProxy = ChildChainManagerProxy.address
  contractAddresses.child.DummyERC20 = ChildERC20.address
  contractAddresses.child.DummyERC721 = ChildERC721.address
  contractAddresses.child.DummyERC1155 = ChildERC1155.address
  contractAddresses.child.MaticWETH = MaticWETH.address
  utils.writeContractAddresses(contractAddresses)
}
