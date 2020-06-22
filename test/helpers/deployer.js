import contracts from './contracts'
import { etherAddress } from './constants'

export const deployFreshRootContracts = async() => {
  const [
    rootChainManagerLogic,
    dummyStateSender,
    erc20Predicate,
    erc721Predicate,
    erc1155Predicate,
    etherPredicate,
    dummyERC20,
    dummyERC721,
    dummyERC1155
  ] = await Promise.all([
    contracts.RootChainManager.new(),
    contracts.DummyStateSender.new(),
    contracts.ERC20Predicate.new(),
    contracts.ERC721Predicate.new(),
    contracts.ERC1155Predicate.new(),
    contracts.EtherPredicate.new(),
    contracts.DummyERC20.new('Dummy ERC20', 'DERC20'),
    contracts.DummyERC721.new('Dummy ERC721', 'DERC721'),
    contracts.DummyERC1155.new('Dummy ERC1155')
  ])

  const rootChainManagerProxy = await contracts.RootChainManagerProxy.new(rootChainManagerLogic.address)
  const rootChainManager = await contracts.RootChainManager.at(rootChainManagerProxy.address)

  return {
    rootChainManager,
    dummyStateSender,
    erc20Predicate,
    erc721Predicate,
    erc1155Predicate,
    etherPredicate,
    dummyERC20,
    dummyERC721,
    dummyERC1155
  }
}

export const deployFreshChildContracts = async() => {
  const [
    childChainManagerLogic,
    dummyERC20,
    dummyERC721,
    dummyERC1155,
    maticWETH
  ] = await Promise.all([
    contracts.ChildChainManager.new(),
    contracts.ChildERC20.new('Dummy ERC20', 'DERC20', 18),
    contracts.ChildERC721.new('Dummy ERC721', 'DERC721'),
    contracts.ChildERC1155.new('Dummy ERC1155'),
    contracts.MaticWETH.new()
  ])

  const childChainManagerProxy = await contracts.ChildChainManagerProxy.new(childChainManagerLogic.address)
  const childChainManager = await contracts.ChildChainManager.at(childChainManagerProxy.address)

  return {
    childChainManager,
    dummyERC20,
    dummyERC721,
    dummyERC1155,
    maticWETH
  }
}

export const deployInitializedContracts = async() => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootContracts(),
    deployFreshChildContracts()
  ])

  await root.rootChainManager.setStateSender(root.dummyStateSender.address)
  await root.rootChainManager.setChildChainManagerAddress(child.childChainManager.address)

  const MANAGER_ROLE = await root.erc20Predicate.MANAGER_ROLE()
  const DEPOSITOR_ROLE = await child.dummyERC20.DEPOSITOR_ROLE()

  const ERC20Type = await root.erc20Predicate.TOKEN_TYPE()
  await root.erc20Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC20Type, root.erc20Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC20.address, child.dummyERC20.address, ERC20Type)
  await child.dummyERC20.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)
  await child.childChainManager.mapToken(root.dummyERC20.address, child.dummyERC20.address)

  const ERC721Type = await root.erc721Predicate.TOKEN_TYPE()
  await root.erc721Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC721Type, root.erc721Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC721.address, child.dummyERC721.address, ERC721Type)
  await child.dummyERC721.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)
  await child.childChainManager.mapToken(root.dummyERC721.address, child.dummyERC721.address)

  const ERC1155Type = await root.erc1155Predicate.TOKEN_TYPE()
  await root.erc1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC1155Type, root.erc1155Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC1155.address, child.dummyERC1155.address, ERC1155Type)
  await child.dummyERC1155.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)
  await child.childChainManager.mapToken(root.dummyERC1155.address, child.dummyERC1155.address)

  const EtherType = await root.etherPredicate.TOKEN_TYPE()
  await root.etherPredicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(EtherType, root.etherPredicate.address)
  await root.rootChainManager.mapToken(etherAddress, child.maticWETH.address, EtherType)
  await child.maticWETH.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)
  await child.childChainManager.mapToken(etherAddress, child.maticWETH.address)

  return { root, child }
}
