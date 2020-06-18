const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC20Proxy = artifacts.require('ChildERC20Proxy')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildERC721Proxy = artifacts.require('ChildERC721Proxy')
const ChildERC1155 = artifacts.require('ChildERC1155')
const ChildERC1155Proxy = artifacts.require('ChildERC1155Proxy')
const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')

module.exports = async(deployer) => {
  const childChainManager = await deployer.deploy(ChildChainManager)
  const childChainManagerProxy = await deployer.deploy(ChildChainManagerProxy, '0x0000000000000000000000000000000000000000')
  await childChainManagerProxy.updateAndCall(childChainManager.address, childChainManager.contract.methods.initialize().encodeABI())

  const childERC20 = await deployer.deploy(ChildERC20, 'Dummy ERC20', 'DERC20')
  const childERC20Proxy = await deployer.deploy(ChildERC20Proxy, '0x0000000000000000000000000000000000000000')
  await childERC20Proxy.updateAndCall(childERC20.address, childERC20.contract.methods.initialize(18).encodeABI())

  const childERC721 = await deployer.deploy(ChildERC721, 'Dummy ERC721', 'DERC721')
  const childERC721Proxy = await deployer.deploy(ChildERC721Proxy, '0x0000000000000000000000000000000000000000')
  await childERC721Proxy.updateAndCall(childERC721.address, childERC721.contract.methods.initialize().encodeABI())

  const childERC1155 = await deployer.deploy(ChildERC1155, 'Dummy ERC1155')
  const childERC1155Proxy = await deployer.deploy(ChildERC1155Proxy, '0x0000000000000000000000000000000000000000')
  await childERC1155Proxy.updateAndCall(childERC1155.address, childERC1155.contract.methods.initialize().encodeABI())

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
