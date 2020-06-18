const RootChainManager = artifacts.require('RootChainManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const EtherPredicate = artifacts.require('EtherPredicate')

const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer, network) => {
  if (network === 'test') return

  const contractAddresses = utils.getContractAddresses()

  const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)
  const ERC20PredicateInstance = await ERC20Predicate.at(contractAddresses.root.ERC20Predicate)
  const ERC721PredicateInstance = await ERC721Predicate.at(contractAddresses.root.ERC721Predicate)
  const ERC1155PredicateInstance = await ERC1155Predicate.at(contractAddresses.root.ERC1155Predicate)
  const EtherPredicateInstance = await EtherPredicate.at(contractAddresses.root.EtherPredicate)

  console.log('Setting StateSender')
  await RootChainManagerInstance.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManagerProxy)

  console.log('Setting CheckpointManager')
  await RootChainManagerInstance.setCheckpointManager(config.plasmaRootChain)

  console.log('Granting manager role on ERC20Predicate')
  const MANAGER_ROLE = await ERC20PredicateInstance.MANAGER_ROLE()
  await ERC20PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC721Predicate')
  await ERC721PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC71155Predicate')
  await ERC1155PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on EtherPredicate')
  await EtherPredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Registering ERC20Predicate')
  const ERC20Type = await ERC20PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC20Type, ERC20PredicateInstance.address)

  console.log('Registering ERC721Predicate')
  const ERC721Type = await ERC721PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC721Type, ERC721PredicateInstance.address)

  console.log('Registering ERC1155Predicate')
  const ERC1155Type = await ERC1155PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC1155Type, ERC1155PredicateInstance.address)

  console.log('Registering EtherPredicate')
  const EtherType = await EtherPredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(EtherType, EtherPredicateInstance.address)

  console.log('Mapping DummyERC20')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC20, contractAddresses.child.DummyERC20, ERC20Type)

  console.log('Mapping DummyERC721')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC721, contractAddresses.child.DummyERC721, ERC721Type)

  console.log('Mapping DummyERC1155')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC1155, contractAddresses.child.DummyERC1155, ERC1155Type)

  console.log('Mapping Ether')
  await RootChainManagerInstance.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', contractAddresses.child.MaticWETH, EtherType)
}
