const RootChainManager = artifacts.require('RootChainManager')

const ERC20Predicate = artifacts.require('ERC20Predicate')
const MintableERC20Predicate = artifacts.require('MintableERC20Predicate')

const ERC721Predicate = artifacts.require('ERC721Predicate')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')

const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const MintableERC1155Predicate = artifacts.require('MintableERC1155Predicate')

const EtherPredicate = artifacts.require('EtherPredicate')

const DummyMintableERC20 = artifacts.require('DummyMintableERC20')
const DummyMintableERC721 = artifacts.require('DummyMintableERC721')
const DummyMintableERC1155 = artifacts.require('DummyMintableERC1155')

const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()

  const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)

  const ERC20PredicateInstance = await ERC20Predicate.at(contractAddresses.root.ERC20PredicateProxy)
  const MintableERC20PredicateInstance = await MintableERC20Predicate.at(contractAddresses.root.MintableERC20PredicateProxy)

  const ERC721PredicateInstance = await ERC721Predicate.at(contractAddresses.root.ERC721PredicateProxy)
  const MintableERC721PredicateInstance = await MintableERC721Predicate.at(contractAddresses.root.MintableERC721PredicateProxy)

  const ERC1155PredicateInstance = await ERC1155Predicate.at(contractAddresses.root.ERC1155PredicateProxy)
  const MintableERC1155PredicateInstance = await MintableERC1155Predicate.at(contractAddresses.root.MintableERC1155PredicateProxy)

  const EtherPredicateInstance = await EtherPredicate.at(contractAddresses.root.EtherPredicateProxy)

  const DummyMintableERC20Instance = await DummyMintableERC20.at(contractAddresses.root.DummyMintableERC20)
  const DummyMintableERC721Instance = await DummyMintableERC721.at(contractAddresses.root.DummyMintableERC721)
  const DummyMintableERC1155Instance = await DummyMintableERC1155.at(contractAddresses.root.DummyMintableERC1155)

  console.log('Setting StateSender')
  await RootChainManagerInstance.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManagerProxy)

  console.log('Setting CheckpointManager')
  await RootChainManagerInstance.setCheckpointManager(config.plasmaRootChain)

  console.log('Granting manager role on ERC20Predicate')
  const MANAGER_ROLE = await ERC20PredicateInstance.MANAGER_ROLE()
  await ERC20PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC20Predicate')
  await MintableERC20PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC721Predicate')
  await ERC721PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC721Predicate')
  await MintableERC721PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC71155Predicate')
  await ERC1155PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC71155Predicate')
  await MintableERC1155PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on EtherPredicate')
  await EtherPredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  const PREDICATE_ROLE = await DummyMintableERC20Instance.PREDICATE_ROLE()

  console.log('Granting predicate role on DummyMintableERC20')
  await DummyMintableERC20Instance.grantRole(PREDICATE_ROLE, MintableERC20PredicateInstance.address)

  console.log('Granting predicate role on DummyMintableERC721')
  await DummyMintableERC721Instance.grantRole(PREDICATE_ROLE, MintableERC721PredicateInstance.address)

  console.log('Granting predicate role on DummyMintableERC1155')
  await DummyMintableERC1155Instance.grantRole(PREDICATE_ROLE, MintableERC1155PredicateInstance.address)

  console.log('Registering ERC20Predicate')
  const ERC20Type = await ERC20PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC20Type, ERC20PredicateInstance.address)

  console.log('Registering MintableERC20Predicate')
  const MintableERC20Type = await MintableERC20PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC20Type, MintableERC20PredicateInstance.address)

  console.log('Registering ERC721Predicate')
  const ERC721Type = await ERC721PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC721Type, ERC721PredicateInstance.address)

  console.log('Registering MintableERC721Predicate')
  const MintableERC721Type = await MintableERC721PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC721Type, MintableERC721PredicateInstance.address)

  console.log('Registering ERC1155Predicate')
  const ERC1155Type = await ERC1155PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC1155Type, ERC1155PredicateInstance.address)

  console.log('Registering MintableERC1155Predicate')
  const MintableERC1155Type = await MintableERC1155PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC1155Type, MintableERC1155PredicateInstance.address)

  console.log('Registering EtherPredicate')
  const EtherType = await EtherPredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(EtherType, EtherPredicateInstance.address)

  console.log('Mapping DummyERC20')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC20, contractAddresses.child.DummyERC20, ERC20Type)

  console.log('Mapping DummyMintableERC20')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC20, contractAddresses.child.DummyMintableERC20, MintableERC20Type)

  console.log('Mapping DummyERC721')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC721, contractAddresses.child.DummyERC721, ERC721Type)

  console.log('Mapping DummyMintableERC721')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC721, contractAddresses.child.DummyMintableERC721, MintableERC721Type)

  console.log('Mapping DummyERC1155')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC1155, contractAddresses.child.DummyERC1155, ERC1155Type)

  console.log('Mapping DummyMintableERC1155')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC1155, contractAddresses.child.DummyMintableERC1155, MintableERC1155Type)

  console.log('Mapping Ether')
  await RootChainManagerInstance.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', contractAddresses.child.MaticWETH, EtherType)
}
