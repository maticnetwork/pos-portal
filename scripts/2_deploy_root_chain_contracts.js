const bluebird = require('bluebird')

const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const RLPReader = artifacts.require('RLPReader')
const SafeERC20 = artifacts.require('SafeERC20')
const SafeMath = artifacts.require('SafeMath')

const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const DummyStateSender = artifacts.require('DummyStateSender')

const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC20PredicateProxy = artifacts.require('ERC20PredicateProxy')
const MintableERC20Predicate = artifacts.require('MintableERC20Predicate')
const MintableERC20PredicateProxy = artifacts.require('MintableERC20PredicateProxy')

const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC721PredicateProxy = artifacts.require('ERC721PredicateProxy')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const MintableERC721PredicateProxy = artifacts.require('MintableERC721PredicateProxy')

const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const ERC1155PredicateProxy = artifacts.require('ERC1155PredicateProxy')
const MintableERC1155Predicate = artifacts.require('MintableERC1155Predicate')
const MintableERC1155PredicateProxy = artifacts.require('MintableERC1155PredicateProxy')

const EtherPredicate = artifacts.require('EtherPredicate')
const EtherPredicateProxy = artifacts.require('EtherPredicateProxy')

const DummyERC20 = artifacts.require('DummyERC20')
const DummyMintableERC20 = artifacts.require('DummyMintableERC20')

const DummyERC721 = artifacts.require('DummyERC721')
const DummyMintableERC721 = artifacts.require('DummyMintableERC721')

const DummyERC1155 = artifacts.require('DummyERC1155')
const DummyMintableERC1155 = artifacts.require('DummyMintableERC1155')

const TestRootTunnel = artifacts.require('TestRootTunnel')
const TestChildTunnel = artifacts.require('TestChildTunnel')

const utils = require('./utils')

module.exports = async(deployer, network, accounts) => {
  await deployer

  console.log('deploying contracts...')
  const rootChainManager = await deployer.deploy(RootChainManager)
  const rootChainManagerProxy = await deployer.deploy(RootChainManagerProxy, '0x0000000000000000000000000000000000000000')
  await rootChainManagerProxy.updateAndCall(RootChainManager.address, rootChainManager.contract.methods.initialize(accounts[0]).encodeABI())

  // -- ERC20 Predicates Deployment, starting
  const erc20Predicate = await deployer.deploy(ERC20Predicate)
  const erc20PredicateProxy = await deployer.deploy(ERC20PredicateProxy, '0x0000000000000000000000000000000000000000')
  await erc20PredicateProxy.updateAndCall(erc20Predicate.address, erc20Predicate.contract.methods.initialize(accounts[0]).encodeABI())

  // Mintable version of ERC20 👇
  const mintableErc20Predicate = await deployer.deploy(MintableERC20Predicate)
  const mintableErc20PredicateProxy = await deployer.deploy(MintableERC20PredicateProxy, '0x0000000000000000000000000000000000000000')
  await mintableErc20PredicateProxy.updateAndCall(mintableErc20Predicate.address, mintableErc20Predicate.contract.methods.initialize(accounts[0]).encodeABI())
  // -- ERC20 Predicates Deployment, ending

  // -- ERC721 Predicates Deployment, starting
  const erc721Predicate = await deployer.deploy(ERC721Predicate)
  const erc721PredicateProxy = await deployer.deploy(ERC721PredicateProxy, '0x0000000000000000000000000000000000000000')
  await erc721PredicateProxy.updateAndCall(erc721Predicate.address, erc721Predicate.contract.methods.initialize(accounts[0]).encodeABI())

  // Mintable version of ERC721 👇
  const mintableERC721Predicate = await deployer.deploy(MintableERC721Predicate)
  const mintableERC721PredicateProxy = await deployer.deploy(MintableERC721PredicateProxy, '0x0000000000000000000000000000000000000000')
  await mintableERC721PredicateProxy.updateAndCall(mintableERC721Predicate.address, mintableERC721Predicate.contract.methods.initialize(accounts[0]).encodeABI())
  // -- ERC721 Predicates Deployment, ending

  // -- ERC1155 Predicates Deployment, starting
  const erc1155Predicate = await deployer.deploy(ERC1155Predicate)
  const erc1155PredicateProxy = await deployer.deploy(ERC1155PredicateProxy, '0x0000000000000000000000000000000000000000')
  await erc1155PredicateProxy.updateAndCall(erc1155Predicate.address, erc1155Predicate.contract.methods.initialize(accounts[0]).encodeABI())

  // Mintable version of ERC1155 👇
  const mintableErc1155Predicate = await deployer.deploy(MintableERC1155Predicate)
  const mintableErc1155PredicateProxy = await deployer.deploy(MintableERC1155PredicateProxy, '0x0000000000000000000000000000000000000000')
  await mintableErc1155PredicateProxy.updateAndCall(mintableErc1155Predicate.address, mintableErc1155Predicate.contract.methods.initialize(accounts[0]).encodeABI())
  // -- ERC721 Predicates Deployment, ending

  const etherPredicate = await deployer.deploy(EtherPredicate)
  const etherPredicateProxy = await deployer.deploy(EtherPredicateProxy, '0x0000000000000000000000000000000000000000')
  await etherPredicateProxy.updateAndCall(etherPredicate.address, etherPredicate.contract.methods.initialize(accounts[0]).encodeABI())

  await deployer.deploy(DummyStateSender)

  // -- Dummy version of ERC20
  await deployer.deploy(DummyERC20, 'Dummy ERC20', 'DERC20')
  await deployer.deploy(DummyMintableERC20, 'Dummy Mintable ERC20', 'DERC20')
  // -- ends
  
  // -- Dummy version of ERC721
  await deployer.deploy(DummyERC721, 'Dummy ERC721', 'DERC721')
  await deployer.deploy(DummyMintableERC721, 'Dummy Mintable ERC721', 'DMERC721')
  // -- ends

  // -- Dummy version of ERC1155
  await deployer.deploy(DummyERC1155, 'Dummy ERC1155')
  await deployer.deploy(DummyMintableERC1155, 'Dummy Mintable ERC1155')
  // -- ends
  
  const contractAddresses = utils.getContractAddresses()

  contractAddresses.root.RootChainManager = RootChainManager.address
  contractAddresses.root.RootChainManagerProxy = RootChainManagerProxy.address

  contractAddresses.root.DummyStateSender = DummyStateSender.address

  contractAddresses.root.ERC20Predicate = ERC20Predicate.address
  contractAddresses.root.ERC20PredicateProxy = ERC20PredicateProxy.address
  contractAddresses.root.MintableERC20Predicate = MintableERC20Predicate.address
  contractAddresses.root.MintableERC20PredicateProxy = MintableERC20PredicateProxy.address
  
  contractAddresses.root.ERC721Predicate = ERC721Predicate.address
  contractAddresses.root.ERC721PredicateProxy = ERC721PredicateProxy.address
  contractAddresses.root.MintableERC721Predicate = MintableERC721Predicate.address
  contractAddresses.root.MintableERC721PredicateProxy = MintableERC721PredicateProxy.address
  
  contractAddresses.root.ERC1155Predicate = ERC1155Predicate.address
  contractAddresses.root.ERC1155PredicateProxy = ERC1155PredicateProxy.address
  contractAddresses.root.MintableERC1155Predicate = MintableERC1155Predicate.address
  contractAddresses.root.MintableERC1155PredicateProxy = MintableERC1155PredicateProxy.address
  
  contractAddresses.root.EtherPredicate = EtherPredicate.address
  contractAddresses.root.EtherPredicateProxy = EtherPredicateProxy.address
  
  contractAddresses.root.DummyERC20 = DummyERC20.address
  contractAddresses.root.DummyMintableERC20 = DummyMintableERC20.address
  
  contractAddresses.root.DummyERC721 = DummyERC721.address
  contractAddresses.root.DummyMintableERC721 = DummyMintableERC721.address
  
  contractAddresses.root.DummyERC1155 = DummyERC1155.address
  contractAddresses.root.DummyMintableERC1155 = DummyMintableERC1155.address

  utils.writeContractAddresses(contractAddresses)
}
