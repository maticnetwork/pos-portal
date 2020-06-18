const bluebird = require('bluebird')

const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const RLPReader = artifacts.require('RLPReader')

const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const DummyStateSender = artifacts.require('DummyStateSender')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const EtherPredicate = artifacts.require('EtherPredicate')
const DummyERC20 = artifacts.require('DummyERC20')
const DummyERC721 = artifacts.require('DummyERC721')
const DummyERC1155 = artifacts.require('DummyERC1155')

const utils = require('./utils')

const libDeps = [
  {
    lib: Merkle,
    contracts: [RootChainManager]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [RootChainManager]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChainManager,
      ERC20Predicate,
      ERC721Predicate,
      ERC1155Predicate
    ]
  }
]

module.exports = async(deployer, network) => {

  console.log('linking libs...')
  await bluebird.map(libDeps, async e => {
    await deployer.deploy(e.lib)
    deployer.link(e.lib, e.contracts)
  })

  if (network === 'test') return

  console.log('deploying contracts...')
  await deployer.deploy(RootChainManager)
  await deployer.deploy(RootChainManagerProxy, RootChainManager.address)
  await deployer.deploy(DummyStateSender)
  await deployer.deploy(ERC20Predicate)
  await deployer.deploy(ERC721Predicate)
  await deployer.deploy(ERC1155Predicate)
  await deployer.deploy(EtherPredicate)
  await deployer.deploy(DummyERC20, 'Dummy ERC20', 'DERC20')
  await deployer.deploy(DummyERC721, 'Dummy ERC721', 'DERC721')
  await deployer.deploy(DummyERC1155, 'Dummy ERC1155')

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.root.RootChainManager = RootChainManager.address
  contractAddresses.root.RootChainManagerProxy = RootChainManagerProxy.address
  contractAddresses.root.DummyStateSender = DummyStateSender.address
  contractAddresses.root.ERC20Predicate = ERC20Predicate.address
  contractAddresses.root.ERC721Predicate = ERC721Predicate.address
  contractAddresses.root.ERC1155Predicate = ERC1155Predicate.address
  contractAddresses.root.EtherPredicate = EtherPredicate.address
  contractAddresses.root.DummyERC20 = DummyERC20.address
  contractAddresses.root.DummyERC721 = DummyERC721.address
  contractAddresses.root.DummyERC1155 = DummyERC1155.address
  utils.writeContractAddresses(contractAddresses)
}
