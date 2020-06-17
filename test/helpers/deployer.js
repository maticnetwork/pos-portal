import contracts from './contracts'

export const deployFreshRootContracts = async() => {
  const [
    rootChainManager,
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

  const rootChainManagerProxy = await contracts.RootChainManagerProxy.new(rootChainManager.address)

  return {
    rootChainManager: rootChainManagerProxy,
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
    childChainManager,
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

  const childChainManagerProxy = await contracts.ChildChainManagerProxy.new(childChainManager.address)

  return {
    childChainManager: childChainManagerProxy,
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

  await Promise.all([
    root.rootChainManager.setStateSender(root.dummyStateSender.address),
    root.rootChainManager.setChildChainManagerAddress(child.childChainManager.address),
    // TODO: set checkpoint manager
    // root.rootChainManager.mapToken(root.dummyToken.address, child.dummyToken.address),
    // child.childChainManager.mapToken(root.dummyToken.address, child.dummyToken.address)
  ])

  // const DEPOSITOR_ROLE = await child.dummyToken.DEPOSITOR_ROLE()
  // child.dummyToken.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)

  const MANAGER_ROLE = await root.erc20Predicate.MANAGER_ROLE()
  const DEPOSITOR_ROLE = await child.dummyERC20.DEPOSITOR_ROLE()

  const ERC20Type = await root.erc20Predicate.TOKEN_TYPE()
  await root.erc20Predicate.grantRole(MANAGER_ROLE, root.childChainManager.address)
  await root.rootChainManager.registerPredicate(ERC20Type, root.erc20Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC20, child.dummyERC20, ERC20Type)
  await child.dummyERC20.grantRole(DEPOSITOR_ROLE, child.childChainManager)
  await child.childChainManager.mapToken(root.dummyERC20, child.dummyERC20)

  const ERC721Type = await root.erc721Predicate.TOKEN_TYPE()
  await root.erc721Predicate.grantRole(MANAGER_ROLE, root.childChainManager.address)
  await root.rootChainManager.registerPredicate(ERC721Type, root.erc721Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC721, child.dummyERC721, ERC721Type)
  await child.dummyERC721.grantRole(DEPOSITOR_ROLE, child.childChainManager)
  await child.childChainManager.mapToken(root.dummyERC721, child.dummyERC721)

  const ERC1155Type = await root.erc1155Predicate.TOKEN_TYPE()
  await root.erc1155Predicate.grantRole(MANAGER_ROLE, root.childChainManager.address)
  await root.rootChainManager.registerPredicate(ERC1155Type, root.erc1155Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC1155, child.dummyERC1155, ERC1155Type)
  await child.dummyERC1155.grantRole(DEPOSITOR_ROLE, child.childChainManager)
  await child.childChainManager.mapToken(root.dummyERC1155, child.dummyERC1155)

  const EtherType = await root.etherPredicate.TOKEN_TYPE()
  await root.etherPredicate.grantRole(MANAGER_ROLE, root.childChainManager.address)
  await root.rootChainManager.registerPredicate(EtherType, root.etherPredicate.address)
  await root.rootChainManager.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', child.maticWETH, EtherType)
  await child.maticWETH.grantRole(DEPOSITOR_ROLE, child.childChainManager)
  await child.childChainManager.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', child.maticWETH)

  return { root, child }
}
