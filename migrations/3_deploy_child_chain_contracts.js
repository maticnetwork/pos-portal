const bluebird = require('bluebird')

const ContextLib = artifacts.require('ContextLib')

const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildMintableERC721 = artifacts.require('ChildMintableERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')

const libDeps = [
  {
    lib: ContextLib,
    contracts: [ChildERC20, ChildERC721, ChildERC1155, ChildMintableERC721]
  }
]

module.exports = async(deployer, network, accounts) => {
  deployer.then(async() => {
    console.log('linking libs...')
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    const childChainManager = await deployer.deploy(ChildChainManager)
    const childChainManagerProxy = await deployer.deploy(ChildChainManagerProxy, '0x0000000000000000000000000000000000000000')
    await childChainManagerProxy.updateAndCall(childChainManager.address, childChainManager.contract.methods.initialize(accounts[0]).encodeABI())

    await deployer.deploy(ChildERC20, 'Dummy ERC20', 'DERC20', 18)
    await deployer.deploy(ChildERC721, 'Dummy ERC721', 'DERC721')
    await deployer.deploy(ChildMintableERC721, 'Dummy Mintable ERC721', 'DMERC721')
    await deployer.deploy(ChildERC1155, 'Dummy ERC1155')
    await deployer.deploy(MaticWETH)

    const contractAddresses = utils.getContractAddresses()
    contractAddresses.child.ChildChainManager = ChildChainManager.address
    contractAddresses.child.ChildChainManagerProxy = ChildChainManagerProxy.address
    contractAddresses.child.DummyERC20 = ChildERC20.address
    contractAddresses.child.DummyERC721 = ChildERC721.address
    contractAddresses.child.DummyMintableERC721 = ChildMintableERC721.address
    contractAddresses.child.DummyERC1155 = ChildERC1155.address
    contractAddresses.child.MaticWETH = MaticWETH.address
    utils.writeContractAddresses(contractAddresses)
  })
}
