import { etherAddress } from './constants.js'

export const deployFreshRootContracts = async (accounts) => {
  const CheckpointManager = await ethers.getContractFactory('MockCheckpointManager')
  const checkpointManager = await CheckpointManager.deploy()
  await checkpointManager.deployed()

  const RootChainManager = await ethers.getContractFactory('RootChainManager')
  const rootChainManagerLogic = await RootChainManager.deploy()
  await rootChainManagerLogic.deployed()

  const DummyStateSender = await ethers.getContractFactory('DummyStateSender')
  const dummyStateSender = await DummyStateSender.deploy()
  await dummyStateSender.deployed()

  const ERC20Predicate = await ethers.getContractFactory('ERC20Predicate')
  const erc20PredicateLogic = await ERC20Predicate.deploy()
  await erc20PredicateLogic.deployed()

  const MintableERC20Predicate = await ethers.getContractFactory('MintableERC20Predicate')
  const mintableERC20PredicateLogic = await MintableERC20Predicate.deploy()
  await mintableERC20PredicateLogic.deployed()

  const ERC721Predicate = await ethers.getContractFactory('ERC721Predicate')
  const erc721PredicateLogic = await ERC721Predicate.deploy()
  await erc721PredicateLogic.deployed()

  const MintableERC721Predicate = await ethers.getContractFactory('MintableERC721Predicate')
  const mintableERC721PredicateLogic = await MintableERC721Predicate.deploy()
  await mintableERC721PredicateLogic.deployed()

  const ERC1155Predicate = await ethers.getContractFactory('ERC1155Predicate')
  const erc1155PredicateLogic = await ERC1155Predicate.deploy()
  await erc1155PredicateLogic.deployed()

  const MintableERC1155Predicate = await ethers.getContractFactory('MintableERC1155Predicate')
  const mintableERC1155PredicateLogic = await MintableERC1155Predicate.deploy()
  await mintableERC1155PredicateLogic.deployed()

  const ChainExitERC1155Predicate = await ethers.getContractFactory('ChainExitERC1155Predicate')
  const chainExitERC1155PredicateLogic = await ChainExitERC1155Predicate.deploy()
  await chainExitERC1155PredicateLogic.deployed()

  const EtherPredicate = await ethers.getContractFactory('EtherPredicate')
  const etherPredicateLogic = await EtherPredicate.deploy()
  await etherPredicateLogic.deployed()

  const DummyERC20 = await ethers.getContractFactory('DummyERC20')
  const dummyERC20 = await DummyERC20.deploy('Dummy ERC20', 'DERC20')
  await dummyERC20.deployed()

  const DummyMintableERC20 = await ethers.getContractFactory('DummyMintableERC20')
  const dummyMintableERC20 = await DummyMintableERC20.deploy('Dummy Mintable ERC20', 'DMERC20')
  await dummyMintableERC20.deployed()

  const DummyERC721 = await ethers.getContractFactory('DummyERC721')
  const dummyERC721 = await DummyERC721.deploy('Dummy ERC721', 'DERC721')
  await dummyERC721.deployed()

  const DummyMintableERC721 = await ethers.getContractFactory('DummyMintableERC721')
  const dummyMintableERC721 = await DummyMintableERC721.deploy('Dummy Mintable ERC721', 'DMERC721')
  await dummyMintableERC721.deployed()

  const DummyERC1155 = await ethers.getContractFactory('DummyERC1155')
  const dummyERC1155 = await DummyERC1155.deploy('Dummy ERC1155')
  await dummyERC1155.deployed()

  const DummyMintableERC1155 = await ethers.getContractFactory('DummyMintableERC1155')
  const dummyMintableERC1155 = await DummyMintableERC1155.deploy('Dummy Mintable ERC1155')
  await dummyMintableERC1155.deployed()

  const ExitPayloadReaderTest = await ethers.getContractFactory('ExitPayloadReaderTest')
  const exitPayloadReaderTest = await ExitPayloadReaderTest.deploy()
  await exitPayloadReaderTest.deployed()

  const RootChainManagerProxy = await ethers.getContractFactory('RootChainManagerProxy')
  const rootChainManagerProxy = await RootChainManagerProxy.deploy('0x0000000000000000000000000000000000000000')
  await rootChainManagerProxy.deployed()

  const rootChainManager = RootChainManager.attach(rootChainManagerProxy.address)
  await rootChainManagerProxy.updateAndCall(
    rootChainManagerLogic.address,
    rootChainManagerLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const ERC20PredicateProxy = await ethers.getContractFactory('ERC20PredicateProxy')
  const erc20PredicateProxy = await ERC20PredicateProxy.deploy('0x0000000000000000000000000000000000000000')
  await erc20PredicateProxy.deployed()

  const erc20Predicate = ERC20Predicate.attach(erc20PredicateProxy.address)
  await erc20PredicateProxy.updateAndCall(
    erc20PredicateLogic.address,
    erc20PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const MintableERC20PredicateProxy = await ethers.getContractFactory('MintableERC20PredicateProxy')
  const mintableERC20PredicateProxy = await MintableERC20PredicateProxy.deploy(
    '0x0000000000000000000000000000000000000000'
  )
  await mintableERC20PredicateProxy.deployed()

  const mintableERC20Predicate = MintableERC20Predicate.attach(mintableERC20PredicateProxy.address)
  await mintableERC20PredicateProxy.updateAndCall(
    mintableERC20PredicateLogic.address,
    mintableERC20PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const ERC721PredicateProxy = await ethers.getContractFactory('ERC721PredicateProxy')
  const erc721PredicateProxy = await ERC721PredicateProxy.deploy('0x0000000000000000000000000000000000000000')
  await erc721PredicateProxy.deployed()

  const erc721Predicate = ERC721Predicate.attach(erc721PredicateProxy.address)
  await erc721PredicateProxy.updateAndCall(
    erc721PredicateLogic.address,
    erc721PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const MintableERC721PredicateProxy = await ethers.getContractFactory('MintableERC721PredicateProxy')
  const mintableERC721PredicateProxy = await MintableERC721PredicateProxy.deploy(
    '0x0000000000000000000000000000000000000000'
  )
  await mintableERC721PredicateProxy.deployed()

  const mintableERC721Predicate = MintableERC721Predicate.attach(mintableERC721PredicateProxy.address)
  await mintableERC721PredicateProxy.updateAndCall(
    mintableERC721PredicateLogic.address,
    mintableERC721PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const ERC1155PredicateProxy = await ethers.getContractFactory('ERC1155PredicateProxy')
  const erc1155PredicateProxy = await ERC1155PredicateProxy.deploy('0x0000000000000000000000000000000000000000')
  await erc1155PredicateProxy.deployed()

  const erc1155Predicate = ERC1155Predicate.attach(erc1155PredicateProxy.address)
  await erc1155PredicateProxy.updateAndCall(
    erc1155PredicateLogic.address,
    erc1155PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const MintableERC1155PredicateProxy = await ethers.getContractFactory('MintableERC1155PredicateProxy')
  const mintableERC1155PredicateProxy = await MintableERC1155PredicateProxy.deploy(
    '0x0000000000000000000000000000000000000000'
  )
  await mintableERC1155PredicateProxy.deployed()

  const mintableERC1155Predicate = MintableERC1155Predicate.attach(mintableERC1155PredicateProxy.address)
  await mintableERC1155PredicateProxy.updateAndCall(
    mintableERC1155PredicateLogic.address,
    mintableERC1155PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const ChainExitERC1155PredicateProxy = await ethers.getContractFactory('ChainExitERC1155PredicateProxy')
  const chainExitERC1155PredicateProxy = await ChainExitERC1155PredicateProxy.deploy(
    '0x0000000000000000000000000000000000000000'
  )
  await chainExitERC1155PredicateProxy.deployed()

  const chainExitERC1155Predicate = ChainExitERC1155Predicate.attach(chainExitERC1155PredicateProxy.address)
  await chainExitERC1155PredicateProxy.updateAndCall(
    chainExitERC1155PredicateLogic.address,
    chainExitERC1155PredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const EtherPredicateProxy = await ethers.getContractFactory('EtherPredicateProxy')
  const etherPredicateProxy = await EtherPredicateProxy.deploy('0x0000000000000000000000000000000000000000')
  await etherPredicateProxy.deployed()

  const etherPredicate = EtherPredicate.attach(etherPredicateProxy.address)
  await etherPredicateProxy.updateAndCall(
    etherPredicateLogic.address,
    etherPredicateLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

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

export const deployFreshChildContracts = async (accounts) => {
  const ChildChainManager = await ethers.getContractFactory('ChildChainManager')
  const childChainManagerLogic = await ChildChainManager.deploy()
  await childChainManagerLogic.waitForDeployment()

  const ChildChainManagerProxy = await ethers.getContractFactory('ChildChainManagerProxy')
  const childChainManagerProxy = await ChildChainManagerProxy.deploy(childChainManagerLogic.target)
  await childChainManagerProxy.waitForDeployment()

  const childChainManager = ChildChainManager.attach('0x0000000000000000000000000000000000000000')
  await childChainManagerProxy.updateAndCall(
    childChainManagerLogic.target,
    childChainManagerLogic.interface.encodeFunctionData('initialize', [accounts[0]])
  )

  const DummyERC20 = await ethers.getContractFactory('ChildERC20')
  const dummyERC20 = await DummyERC20.deploy('Dummy ERC20', 'DERC20', 18, childChainManager.target)
  await dummyERC20.waitForDeployment()

  const DummyMintableERC20 = await ethers.getContractFactory('ChildMintableERC20')
  const dummyMintableERC20 = await DummyMintableERC20.deploy(
    'Dummy Mintable ERC20',
    'DMERC20',
    18,
    childChainManager.target
  )
  await dummyMintableERC20.waitForDeployment()

  const DummyERC721 = await ethers.getContractFactory('ChildERC721')
  const dummyERC721 = await DummyERC721.deploy('Dummy ERC721', 'DERC721', childChainManager.target)
  await dummyERC721.waitForDeployment()

  const DummyMintableERC721 = await ethers.getContractFactory('ChildMintableERC721')
  const dummyMintableERC721 = await DummyMintableERC721.deploy(
    'Dummy Mintable ERC721',
    'DMERC721',
    childChainManager.target
  )
  await dummyMintableERC721.waitForDeployment()

  const DummyERC1155 = await ethers.getContractFactory('ChildERC1155')
  const dummyERC1155 = await DummyERC1155.deploy('Dummy ERC1155', childChainManager.target)
  await dummyERC1155.waitForDeployment()

  const DummyMintableERC1155 = await ethers.getContractFactory('ChildMintableERC1155')
  const dummyMintableERC1155 = await DummyMintableERC1155.deploy('Dummy Mintable ERC1155', childChainManager.target)
  await dummyMintableERC1155.waitForDeployment()

  const MaticWETH = await ethers.getContractFactory('MaticWETH')
  const maticWETH = await MaticWETH.deploy(childChainManager.target)
  await maticWETH.waitForDeployment()

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

export const deployInitializedContracts = async (accounts) => {
  const [root, child] = await Promise.all([deployFreshRootContracts(accounts), deployFreshChildContracts(accounts)])

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
  await root.rootChainManager.mapToken(
    root.dummyMintableERC20.address,
    child.dummyMintableERC20.address,
    MintableERC20Type
  )
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
  await root.rootChainManager.mapToken(
    root.dummyMintableERC721.address,
    child.dummyMintableERC721.address,
    MintableERC721Type
  )
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
  await root.rootChainManager.mapToken(
    root.dummyMintableERC1155.address,
    child.dummyMintableERC1155.address,
    MintableERC721Type
  )
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

export const deployFreshRootTunnelContracts = async () => {
  const [testRootTunnel, dummyStateSender, checkpointManager] = await Promise.all([
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

export const deployFreshChildTunnelContracts = async () => {
  const [testChildTunnel] = await Promise.all([contracts.TestChildTunnel.new()])

  return {
    testChildTunnel
  }
}

export const deployInitializedTunnelContracts = async () => {
  const [root, child] = await Promise.all([deployFreshRootTunnelContracts(), deployFreshChildTunnelContracts()])

  await root.testRootTunnel.setCheckpointManager(root.checkpointManager.address)
  await root.testRootTunnel.setStateSender(root.dummyStateSender.address)
  await root.testRootTunnel.setChildTunnel(child.testChildTunnel.address)

  return { root, child }
}

export const deployPotatoContracts = async (accounts) => {
  // deploy pos portal contracts
  const [rootChainManager, stateSender, erc20Predicate, childChainManager] = await Promise.all([
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
  const [MANAGER_ROLE, ERC20Type] = await Promise.all([erc20Predicate.MANAGER_ROLE(), erc20Predicate.TOKEN_TYPE()])

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
