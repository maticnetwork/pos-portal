import contracts from './contracts'
import { etherAddress } from './constants'

export const deployFreshRootContracts = async(accounts) => {
  const [
    checkpointManager,
    rootChainManagerLogic,
    dummyStateSender,
    erc20PredicateLogic,
    mintableERC20PredicateLogic,
    erc721PredicateLogic,
    mintableERC721PredicateLogic,
    erc1155PredicateLogic,
    mintableERC1155PredicateLogic,
    chainExitERC1155PredicateLogic,
    etherPredicateLogic,
    dummyERC20,
    dummyMintableERC20,
    dummyERC721,
    dummyMintableERC721,
    dummyERC1155,
    dummyMintableERC1155,
    exitPayloadReaderTest
  ] = await Promise.all([
    contracts.MockCheckpointManager.new(),
    contracts.RootChainManager.new(),
    contracts.DummyStateSender.new(),
    contracts.ERC20Predicate.new(),
    contracts.MintableERC20Predicate.new(),
    contracts.ERC721Predicate.new(),
    contracts.MintableERC721Predicate.new(),
    contracts.ERC1155Predicate.new(),
    contracts.MintableERC1155Predicate.new(),
    contracts.ChainExitERC1155Predicate.new(),
    contracts.EtherPredicate.new(),
    contracts.DummyERC20.new('Dummy ERC20', 'DERC20'),
    contracts.DummyMintableERC20.new('Dummy Mintable ERC20', 'DMERC20'),
    contracts.DummyERC721.new('Dummy ERC721', 'DERC721'),
    contracts.DummyMintableERC721.new('Dummy Mintable ERC721', 'DMERC721'),
    contracts.DummyERC1155.new('Dummy ERC1155'),
    contracts.DummyMintableERC1155.new('Dummy Mintable ERC1155'),
    contracts.ExitPayloadReaderTest.new()
  ])

  const rootChainManagerProxy = await contracts.RootChainManagerProxy.new('0x0000000000000000000000000000000000000000')
  await rootChainManagerProxy.updateAndCall(rootChainManagerLogic.address, rootChainManagerLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const rootChainManager = await contracts.RootChainManager.at(rootChainManagerProxy.address)

  const erc20PredicateProxy = await contracts.ERC20PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await erc20PredicateProxy.updateAndCall(erc20PredicateLogic.address, erc20PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const erc20Predicate = await contracts.ERC20Predicate.at(erc20PredicateProxy.address)

  const mintableERC20PredicateProxy = await contracts.MintableERC20PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await mintableERC20PredicateProxy.updateAndCall(mintableERC20PredicateLogic.address, mintableERC20PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const mintableERC20Predicate = await contracts.MintableERC20Predicate.at(mintableERC20PredicateProxy.address)

  const erc721PredicateProxy = await contracts.ERC721PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await erc721PredicateProxy.updateAndCall(erc721PredicateLogic.address, erc721PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const erc721Predicate = await contracts.ERC721Predicate.at(erc721PredicateProxy.address)

  const mintableERC721PredicateProxy = await contracts.MintableERC721PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await mintableERC721PredicateProxy.updateAndCall(mintableERC721PredicateLogic.address, mintableERC721PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const mintableERC721Predicate = await contracts.MintableERC721Predicate.at(mintableERC721PredicateProxy.address)

  const erc1155PredicateProxy = await contracts.ERC1155PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await erc1155PredicateProxy.updateAndCall(erc1155PredicateLogic.address, erc1155PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const erc1155Predicate = await contracts.ERC1155Predicate.at(erc1155PredicateProxy.address)

  const mintableERC1155PredicateProxy = await contracts.MintableERC1155PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await mintableERC1155PredicateProxy.updateAndCall(mintableERC1155PredicateLogic.address, mintableERC1155PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const mintableERC1155Predicate = await contracts.MintableERC1155Predicate.at(mintableERC1155PredicateProxy.address)

  const chainExitERC1155PredicateProxy = await contracts.ChainExitERC1155PredicateProxy.new('0x0000000000000000000000000000000000000000')
  await chainExitERC1155PredicateProxy.updateAndCall(chainExitERC1155PredicateLogic.address, chainExitERC1155PredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const chainExitERC1155Predicate = await contracts.ChainExitERC1155Predicate.at(chainExitERC1155PredicateProxy.address)

  const etherPredicateProxy = await contracts.EtherPredicateProxy.new('0x0000000000000000000000000000000000000000')
  await etherPredicateProxy.updateAndCall(etherPredicateLogic.address, etherPredicateLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const etherPredicate = await contracts.EtherPredicate.at(etherPredicateProxy.address)

  return {
    exitPayloadReaderTest,
    checkpointManager,
    rootChainManager,
    dummyStateSender,
    erc20Predicate,
    mintableERC20Predicate,
    erc721Predicate,
    mintableERC721Predicate,
    erc1155Predicate,
    mintableERC1155Predicate,
    chainExitERC1155Predicate,
    etherPredicate,
    dummyERC20,
    dummyMintableERC20,
    dummyERC721,
    dummyMintableERC721,
    dummyERC1155,
    dummyMintableERC1155
  }
}

export const deployFreshChildContracts = async(accounts) => {
  const childChainManagerLogic = await contracts.ChildChainManager.new()
  const childChainManagerProxy = await contracts.ChildChainManagerProxy.new('0x0000000000000000000000000000000000000000')
  await childChainManagerProxy.updateAndCall(childChainManagerLogic.address, childChainManagerLogic.contract.methods.initialize(accounts[0]).encodeABI())
  const childChainManager = await contracts.ChildChainManager.at(childChainManagerProxy.address)

  const [
    dummyERC20,
    dummyMintableERC20,
    dummyERC721,
    dummyMintableERC721,
    dummyERC1155,
    dummyMintableERC1155,
    maticWETH
  ] = await Promise.all([
    contracts.ChildERC20.new('Dummy ERC20', 'DERC20', 18, childChainManager.address),
    contracts.ChildMintableERC20.new('Dummy Mintable ERC20', 'DMERC20', 18, childChainManager.address),
    contracts.ChildERC721.new('Dummy ERC721', 'DERC721', childChainManager.address),
    contracts.ChildMintableERC721.new('Dummy Mintable ERC721', 'DMERC721', childChainManager.address),
    contracts.ChildERC1155.new('Dummy ERC1155', childChainManager.address),
    contracts.ChildMintableERC1155.new('Dummy Mintable ERC1155', childChainManager.address),
    contracts.MaticWETH.new(childChainManager.address)
  ])

  return {
    childChainManager,
    dummyERC20,
    dummyMintableERC20,
    dummyERC721,
    dummyMintableERC721,
    dummyERC1155,
    dummyMintableERC1155,
    maticWETH
  }
}

export const deployInitializedContracts = async(accounts) => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootContracts(accounts),
    deployFreshChildContracts(accounts)
  ])

  await root.rootChainManager.setCheckpointManager(root.checkpointManager.address)
  await root.rootChainManager.setStateSender(root.dummyStateSender.address)
  await root.rootChainManager.setChildChainManagerAddress(child.childChainManager.address)

  const MANAGER_ROLE = await root.erc20Predicate.MANAGER_ROLE()
  const PREDICATE_ROLE = await root.dummyMintableERC20.PREDICATE_ROLE()

  const ERC20Type = await root.erc20Predicate.TOKEN_TYPE()
  await root.erc20Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC20Type, root.erc20Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC20.address, child.dummyERC20.address, ERC20Type)
  await child.childChainManager.mapToken(root.dummyERC20.address, child.dummyERC20.address)

  const MintableERC20Type = await root.mintableERC20Predicate.TOKEN_TYPE()
  await root.mintableERC20Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(MintableERC20Type, root.mintableERC20Predicate.address)
  await root.rootChainManager.mapToken(root.dummyMintableERC20.address, child.dummyMintableERC20.address, MintableERC20Type)
  await child.childChainManager.mapToken(root.dummyMintableERC20.address, child.dummyMintableERC20.address)

  await root.dummyMintableERC20.grantRole(PREDICATE_ROLE, root.mintableERC20Predicate.address)

  const ERC721Type = await root.erc721Predicate.TOKEN_TYPE()
  await root.erc721Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC721Type, root.erc721Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC721.address, child.dummyERC721.address, ERC721Type)
  await child.childChainManager.mapToken(root.dummyERC721.address, child.dummyERC721.address)

  const MintableERC721Type = await root.mintableERC721Predicate.TOKEN_TYPE()
  await root.mintableERC721Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(MintableERC721Type, root.mintableERC721Predicate.address)
  await root.rootChainManager.mapToken(root.dummyMintableERC721.address, child.dummyMintableERC721.address, MintableERC721Type)
  await child.childChainManager.mapToken(root.dummyMintableERC721.address, child.dummyMintableERC721.address)

  await root.dummyMintableERC721.grantRole(PREDICATE_ROLE, root.mintableERC721Predicate.address)

  const ERC1155Type = await root.erc1155Predicate.TOKEN_TYPE()
  await root.erc1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ERC1155Type, root.erc1155Predicate.address)
  await root.rootChainManager.mapToken(root.dummyERC1155.address, child.dummyERC1155.address, ERC1155Type)
  await child.childChainManager.mapToken(root.dummyERC1155.address, child.dummyERC1155.address)

  const MintableERC1155Type = await root.mintableERC1155Predicate.TOKEN_TYPE()
  await root.mintableERC1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(MintableERC1155Type, root.mintableERC1155Predicate.address)
  await root.rootChainManager.mapToken(root.dummyMintableERC1155.address, child.dummyMintableERC1155.address, MintableERC721Type)
  await child.childChainManager.mapToken(root.dummyMintableERC1155.address, child.dummyMintableERC1155.address)

  await root.dummyMintableERC1155.grantRole(PREDICATE_ROLE, root.mintableERC1155Predicate.address)

  const ChainExitERC1155Type = await root.chainExitERC1155Predicate.TOKEN_TYPE()
  await root.chainExitERC1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(ChainExitERC1155Type, root.chainExitERC1155Predicate.address)

  await root.dummyMintableERC1155.grantRole(PREDICATE_ROLE, root.chainExitERC1155Predicate.address)

  const EtherType = await root.etherPredicate.TOKEN_TYPE()
  await root.etherPredicate.grantRole(MANAGER_ROLE, root.rootChainManager.address)
  await root.rootChainManager.registerPredicate(EtherType, root.etherPredicate.address)
  await root.rootChainManager.mapToken(etherAddress, child.maticWETH.address, EtherType)
  await child.childChainManager.mapToken(etherAddress, child.maticWETH.address)

  return { root, child }
}

export const deployFreshRootTunnelContracts = async() => {
  const [
    testRootTunnel,
    dummyStateSender,
    checkpointManager
  ] = await Promise.all([
    contracts.TestRootTunnel.new(),
    contracts.DummyStateSender.new(),
    contracts.MockCheckpointManager.new()
  ])

  return {
    testRootTunnel,
    dummyStateSender,
    checkpointManager
  }
}

export const deployFreshChildTunnelContracts = async() => {
  const [
    testChildTunnel
  ] = await Promise.all([
    contracts.TestChildTunnel.new()
  ])

  return {
    testChildTunnel
  }
}

export const deployInitializedTunnelContracts = async() => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootTunnelContracts(),
    deployFreshChildTunnelContracts()
  ])

  await root.testRootTunnel.setCheckpointManager(root.checkpointManager.address)
  await root.testRootTunnel.setStateSender(root.dummyStateSender.address)
  await root.testRootTunnel.setChildTunnel(child.testChildTunnel.address)

  return { root, child }
}

export const deployPotatoContracts = async(accounts) => {
  // deploy pos portal contracts
  const [
    rootChainManager,
    stateSender,
    erc20Predicate,
    childChainManager
  ] = await Promise.all([
    contracts.RootChainManager.new(),
    contracts.DummyStateSender.new(),
    contracts.ERC20Predicate.new(),
    contracts.ChildChainManager.new()
  ])

  // init pos portal contracts
  await Promise.all([
    rootChainManager.initialize(accounts[0]),
    erc20Predicate.initialize(accounts[0]),
    childChainManager.initialize(accounts[0])
  ])

  // read constants
  const [
    MANAGER_ROLE,
    ERC20Type
  ] = await Promise.all([
    erc20Predicate.MANAGER_ROLE(),
    erc20Predicate.TOKEN_TYPE()
  ])

  // set values on pos portal contracts
  await Promise.all([
    rootChainManager.setStateSender(stateSender.address),
    rootChainManager.setChildChainManagerAddress(childChainManager.address),
    erc20Predicate.grantRole(MANAGER_ROLE, rootChainManager.address),
    rootChainManager.registerPredicate(ERC20Type, erc20Predicate.address)
  ])

  // deploy potato contracts
  const rootPotatoToken = await contracts.RootPotatoToken.new()
  const childPotatoToken = await contracts.ChildPotatoToken.new(childChainManager.address)
  const childPotatoFarm = await contracts.ChildPotatoFarm.new(childPotatoToken.address)
  const childPotatoMigrator = await contracts.ChildPotatoMigrator.new(childPotatoToken.address, childPotatoFarm.address)
  const rootPotatoMigrator = await contracts.RootPotatoMigrator.new(
    stateSender.address,
    rootPotatoToken.address,
    rootChainManager.address,
    erc20Predicate.address,
    childPotatoMigrator.address
  )

  // map potato tokens
  await rootChainManager.mapToken(rootPotatoToken.address, childPotatoToken.address, ERC20Type)
  await childChainManager.mapToken(rootPotatoToken.address, childPotatoToken.address)

  return {
    rootChainManager,
    stateSender,
    erc20Predicate,
    childChainManager,
    rootPotatoMigrator,
    rootPotatoToken,
    childPotatoFarm,
    childPotatoMigrator,
    childPotatoToken
  }
}
