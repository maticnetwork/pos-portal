import { etherAddress, mockValues } from './constants.js';

export const deployFreshRootContracts = async (accounts) => {
  console.log("Deploying root contracts...");
  const CheckpointManager = await ethers.getContractFactory("MockCheckpointManager");
  const checkpointManager = await CheckpointManager.deploy();
  await checkpointManager.waitForDeployment();

  const RootChainManager = await ethers.getContractFactory("RootChainManager");
  const rootChainManagerLogic = await RootChainManager.deploy();
  await rootChainManagerLogic.waitForDeployment();

  const DummyStateSender = await ethers.getContractFactory("DummyStateSender");
  const dummyStateSender = await DummyStateSender.deploy();
  await dummyStateSender.waitForDeployment();

  const ERC20Predicate = await ethers.getContractFactory("ERC20Predicate");
  const erc20PredicateLogic = await ERC20Predicate.deploy();
  await erc20PredicateLogic.waitForDeployment();

  const MintableERC20Predicate = await ethers.getContractFactory("MintableERC20Predicate");
  const mintableERC20PredicateLogic = await MintableERC20Predicate.deploy();
  await mintableERC20PredicateLogic.waitForDeployment();

  const ERC721Predicate = await ethers.getContractFactory("ERC721Predicate");
  const erc721PredicateLogic = await ERC721Predicate.deploy();
  await erc721PredicateLogic.waitForDeployment();

  const MintableERC721Predicate = await ethers.getContractFactory("MintableERC721Predicate");
  const mintableERC721PredicateLogic = await MintableERC721Predicate.deploy();
  await mintableERC721PredicateLogic.waitForDeployment();

  const ERC1155Predicate = await ethers.getContractFactory("ERC1155Predicate");
  const erc1155PredicateLogic = await ERC1155Predicate.deploy();
  await erc1155PredicateLogic.waitForDeployment();

  const MintableERC1155Predicate = await ethers.getContractFactory("MintableERC1155Predicate");
  const mintableERC1155PredicateLogic = await MintableERC1155Predicate.deploy();
  await mintableERC1155PredicateLogic.waitForDeployment();

  const ChainExitERC1155Predicate = await ethers.getContractFactory("ChainExitERC1155Predicate");
  const chainExitERC1155PredicateLogic = await ChainExitERC1155Predicate.deploy();
  await chainExitERC1155PredicateLogic.waitForDeployment();

  const EtherPredicate = await ethers.getContractFactory("EtherPredicate");
  const etherPredicateLogic = await EtherPredicate.deploy();
  await etherPredicateLogic.waitForDeployment();

  const DummyERC20 = await ethers.getContractFactory("DummyERC20");
  const dummyERC20 = await DummyERC20.deploy("Dummy ERC20", "DERC20");
  await dummyERC20.waitForDeployment();

  const DummyMintableERC20 = await ethers.getContractFactory("DummyMintableERC20");
  const dummyMintableERC20 = await DummyMintableERC20.deploy("Dummy Mintable ERC20", "DMERC20");
  await dummyMintableERC20.waitForDeployment();

  const DummyERC721 = await ethers.getContractFactory("DummyERC721");
  const dummyERC721 = await DummyERC721.deploy("Dummy ERC721", "DERC721");
  await dummyERC721.waitForDeployment();

  const DummyMintableERC721 = await ethers.getContractFactory("DummyMintableERC721");
  const dummyMintableERC721 = await DummyMintableERC721.deploy("Dummy Mintable ERC721", "DMERC721");
  await dummyMintableERC721.waitForDeployment();

  const DummyERC1155 = await ethers.getContractFactory("DummyERC1155");
  const dummyERC1155 = await DummyERC1155.deploy("Dummy ERC1155");
  await dummyERC1155.waitForDeployment();

  const DummyMintableERC1155 = await ethers.getContractFactory("DummyMintableERC1155");
  const dummyMintableERC1155 = await DummyMintableERC1155.deploy("Dummy Mintable ERC1155");
  await dummyMintableERC1155.waitForDeployment();

  const ExitPayloadReaderTest = await ethers.getContractFactory("ExitPayloadReaderTest");
  const exitPayloadReaderTest = await ExitPayloadReaderTest.deploy();
  await exitPayloadReaderTest.waitForDeployment();

  const RootChainManagerProxy = await ethers.getContractFactory("RootChainManagerProxy");
  const rootChainManagerProxy = await RootChainManagerProxy.deploy("0x0000000000000000000000000000000000000000");
  await rootChainManagerProxy.waitForDeployment();

  const rootChainManager = RootChainManager.attach(rootChainManagerProxy.target);
  await rootChainManagerProxy.updateAndCall(
    rootChainManagerLogic.target,
    rootChainManagerLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const ERC20PredicateProxy = await ethers.getContractFactory("ERC20PredicateProxy");
  const erc20PredicateProxy = await ERC20PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await erc20PredicateProxy.waitForDeployment();

  const erc20Predicate = ERC20Predicate.attach(erc20PredicateProxy.target);
  await erc20PredicateProxy.updateAndCall(
    erc20PredicateLogic.target,
    erc20PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const MintableERC20PredicateProxy = await ethers.getContractFactory("MintableERC20PredicateProxy");
  const mintableERC20PredicateProxy = await MintableERC20PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await mintableERC20PredicateProxy.waitForDeployment();

  const mintableERC20Predicate = MintableERC20Predicate.attach(mintableERC20PredicateProxy.target);
  await mintableERC20PredicateProxy.updateAndCall(
    mintableERC20PredicateLogic.target,
    mintableERC20PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const ERC721PredicateProxy = await ethers.getContractFactory("ERC721PredicateProxy");
  const erc721PredicateProxy = await ERC721PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await erc721PredicateProxy.waitForDeployment();

  const erc721Predicate = ERC721Predicate.attach(erc721PredicateProxy.target);
  await erc721PredicateProxy.updateAndCall(
    erc721PredicateLogic.target,
    erc721PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const MintableERC721PredicateProxy = await ethers.getContractFactory("MintableERC721PredicateProxy");
  const mintableERC721PredicateProxy = await MintableERC721PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await mintableERC721PredicateProxy.waitForDeployment();

  const mintableERC721Predicate = MintableERC721Predicate.attach(mintableERC721PredicateProxy.target);
  await mintableERC721PredicateProxy.updateAndCall(
    mintableERC721PredicateLogic.target,
    mintableERC721PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const ERC1155PredicateProxy = await ethers.getContractFactory("ERC1155PredicateProxy");
  const erc1155PredicateProxy = await ERC1155PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await erc1155PredicateProxy.waitForDeployment();

  const erc1155Predicate = ERC1155Predicate.attach(erc1155PredicateProxy.target);
  await erc1155PredicateProxy.updateAndCall(
    erc1155PredicateLogic.target,
    erc1155PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const MintableERC1155PredicateProxy = await ethers.getContractFactory("MintableERC1155PredicateProxy");
  const mintableERC1155PredicateProxy = await MintableERC1155PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await mintableERC1155PredicateProxy.waitForDeployment();

  const mintableERC1155Predicate = MintableERC1155Predicate.attach(mintableERC1155PredicateProxy.target);
  await mintableERC1155PredicateProxy.updateAndCall(
    mintableERC1155PredicateLogic.target,
    mintableERC1155PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const ChainExitERC1155PredicateProxy = await ethers.getContractFactory("ChainExitERC1155PredicateProxy");
  const chainExitERC1155PredicateProxy = await ChainExitERC1155PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await chainExitERC1155PredicateProxy.waitForDeployment();

  const chainExitERC1155Predicate = ChainExitERC1155Predicate.attach(chainExitERC1155PredicateProxy.target);
  await chainExitERC1155PredicateProxy.updateAndCall(
    chainExitERC1155PredicateLogic.target,
    chainExitERC1155PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const EtherPredicateProxy = await ethers.getContractFactory("EtherPredicateProxy");
  const etherPredicateProxy = await EtherPredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await etherPredicateProxy.waitForDeployment();

  const etherPredicate = EtherPredicate.attach(etherPredicateProxy.target);
  await etherPredicateProxy.updateAndCall(
    etherPredicateLogic.target,
    etherPredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const TestRootTunnel = await ethers.getContractFactory("TestRootTunnel");
  const testRootTunnel = await TestRootTunnel.deploy();
  await testRootTunnel.waitForDeployment();

  const RootPotatoToken = await ethers.getContractFactory("RootPotatoToken");
  const rootPotatoToken = await RootPotatoToken.deploy();
  await rootPotatoToken.waitForDeployment();

  const RootPotatoMigrator = await ethers.getContractFactory("RootPotatoMigrator");
  const rootPotatoMigrator = await RootPotatoMigrator.deploy(accounts[0],
    rootPotatoToken.target,
    rootChainManager.target,
    erc20Predicate.target,
    mockValues.zeroAddress);
  await rootPotatoMigrator.waitForDeployment();


  return {
    chainExitERC1155Predicate,
    checkpointManager,
    dummyERC1155,
    dummyERC20,
    dummyERC721,
    dummyMintableERC1155,
    dummyMintableERC20,
    dummyMintableERC721,
    dummyStateSender,
    erc1155Predicate,
    erc20Predicate,
    erc721Predicate,
    etherPredicate,
    exitPayloadReaderTest,
    mintableERC1155Predicate,
    mintableERC20Predicate,
    mintableERC721Predicate,
    rootChainManager,
    rootPotatoMigrator,
    rootPotatoToken,
    testRootTunnel
  };
};

export const deployFreshChildContracts = async (accounts) => {
  const ChildChainManager = await ethers.getContractFactory("ChildChainManager");
  const childChainManagerLogic = await ChildChainManager.deploy();
  await childChainManagerLogic.waitForDeployment();

  const ChildChainManagerProxy = await ethers.getContractFactory("ChildChainManagerProxy");
  const childChainManagerProxy = await ChildChainManagerProxy.deploy(childChainManagerLogic.target);
  await childChainManagerProxy.waitForDeployment();

  let childChainManager = ChildChainManager.attach('0x0000000000000000000000000000000000000000');
  await childChainManagerProxy.updateAndCall(
    childChainManagerLogic.target,
    childChainManagerLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );
  childChainManager = ChildChainManager.attach(childChainManagerProxy.target);

  const DummyERC20 = await ethers.getContractFactory("ChildERC20");
  const dummyERC20 = await DummyERC20.deploy('Dummy ERC20', 'DERC20', 18, childChainManager.target);
  await dummyERC20.waitForDeployment();

  const DummyMintableERC20 = await ethers.getContractFactory("ChildMintableERC20");
  const dummyMintableERC20 = await DummyMintableERC20.deploy('Dummy Mintable ERC20', 'DMERC20', 18, childChainManager.target);
  await dummyMintableERC20.waitForDeployment();

  const DummyERC721 = await ethers.getContractFactory("ChildERC721");
  const dummyERC721 = await DummyERC721.deploy('Dummy ERC721', 'DERC721', childChainManager.target);
  await dummyERC721.waitForDeployment();

  const DummyMintableERC721 = await ethers.getContractFactory("ChildMintableERC721");
  const dummyMintableERC721 = await DummyMintableERC721.deploy('Dummy Mintable ERC721', 'DMERC721', childChainManager.target);
  await dummyMintableERC721.waitForDeployment();

  const DummyERC1155 = await ethers.getContractFactory("ChildERC1155");
  const dummyERC1155 = await DummyERC1155.deploy('Dummy ERC1155', childChainManager.target);
  await dummyERC1155.waitForDeployment();

  const DummyMintableERC1155 = await ethers.getContractFactory("ChildMintableERC1155");
  const dummyMintableERC1155 = await DummyMintableERC1155.deploy('Dummy Mintable ERC1155', childChainManager.target);
  await dummyMintableERC1155.waitForDeployment();

  const MaticWETH = await ethers.getContractFactory("MaticWETH");
  const maticWETH = await MaticWETH.deploy(childChainManager.target);
  await maticWETH.waitForDeployment();

  const UChildERC20 = await ethers.getContractFactory("UChildERC20");
  const uChildERC20 = await UChildERC20.deploy();
  await uChildERC20.waitForDeployment();

  const UChildERC20Proxy = await ethers.getContractFactory("UChildERC20Proxy");
  const uChildERC20Proxy = await UChildERC20Proxy.deploy("0x0000000000000000000000000000000000000000");
  await uChildERC20Proxy.waitForDeployment();

  const TestUChildERC20 = await ethers.getContractFactory("TestUChildERC20");
  const testUChildERC20 = await TestUChildERC20.deploy();
  await testUChildERC20.waitForDeployment();

  const UChildDAI = await ethers.getContractFactory("UChildDAI");
  const uChildDAI = await UChildDAI.deploy();
  await uChildDAI.waitForDeployment();

  const TestChildTunnel = await ethers.getContractFactory("TestChildTunnel");
  const testChildTunnel = await TestChildTunnel.deploy();
  await testChildTunnel.waitForDeployment();

  const ChildPotatoFarm = await ethers.getContractFactory("ChildPotatoFarm");
  const childPotatoFarm = await ChildPotatoFarm.deploy(uChildERC20.target);
  await childPotatoFarm.waitForDeployment();

  const ChildPotatoMigrator = await ethers.getContractFactory("ChildPotatoMigrator");
  const childPotatoMigrator = await ChildPotatoMigrator.deploy(uChildERC20.target, childPotatoFarm.target);
  await childPotatoMigrator.waitForDeployment();

  const ChildPotatoToken = await ethers.getContractFactory("ChildPotatoToken");
  const childPotatoToken = await ChildPotatoToken.deploy(childChainManager.target);
  await childPotatoToken.waitForDeployment();

  return {
    childChainManager,
    childPotatoFarm,
    childPotatoMigrator,
    childPotatoToken,
    dummyERC1155,
    dummyERC20,
    dummyERC721,
    dummyMintableERC1155,
    dummyMintableERC20,
    dummyMintableERC721,
    maticWETH,
    testChildTunnel,
    testUChildERC20,
    uChildDAI,
    uChildERC20,
    uChildERC20Proxy
  };
};

export const deployInitializedContracts = async (accounts) => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootContracts(accounts),
    deployFreshChildContracts(accounts)
  ])

  await root.rootChainManager.setCheckpointManager(root.checkpointManager.target)
  await root.rootChainManager.setStateSender(root.dummyStateSender.target)
  await root.rootChainManager.setChildChainManagerAddress(child.childChainManager.target)

  const MANAGER_ROLE = await root.erc20Predicate.MANAGER_ROLE()
  const PREDICATE_ROLE = await root.dummyMintableERC20.PREDICATE_ROLE()

  const ERC20Type = await root.erc20Predicate.TOKEN_TYPE()
  await root.erc20Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(ERC20Type, root.erc20Predicate.target)
  await root.rootChainManager.mapToken(root.dummyERC20.target, child.dummyERC20.target, ERC20Type)
  await child.childChainManager.mapToken(root.dummyERC20.target, child.dummyERC20.target)

  const MintableERC20Type = await root.mintableERC20Predicate.TOKEN_TYPE()
  await root.mintableERC20Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(MintableERC20Type, root.mintableERC20Predicate.target)
  await root.rootChainManager.mapToken(root.dummyMintableERC20.target, child.dummyMintableERC20.target, MintableERC20Type)
  await child.childChainManager.mapToken(root.dummyMintableERC20.target, child.dummyMintableERC20.target)

  await root.dummyMintableERC20.grantRole(PREDICATE_ROLE, root.mintableERC20Predicate.target)

  const ERC721Type = await root.erc721Predicate.TOKEN_TYPE()
  await root.erc721Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(ERC721Type, root.erc721Predicate.target)
  await root.rootChainManager.mapToken(root.dummyERC721.target, child.dummyERC721.target, ERC721Type)
  await child.childChainManager.mapToken(root.dummyERC721.target, child.dummyERC721.target)

  const MintableERC721Type = await root.mintableERC721Predicate.TOKEN_TYPE()
  await root.mintableERC721Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(MintableERC721Type, root.mintableERC721Predicate.target)
  await root.rootChainManager.mapToken(root.dummyMintableERC721.target, child.dummyMintableERC721.target, MintableERC721Type)
  await child.childChainManager.mapToken(root.dummyMintableERC721.target, child.dummyMintableERC721.target)

  await root.dummyMintableERC721.grantRole(PREDICATE_ROLE, root.mintableERC721Predicate.target)

  const ERC1155Type = await root.erc1155Predicate.TOKEN_TYPE()
  await root.erc1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(ERC1155Type, root.erc1155Predicate.target)
  await root.rootChainManager.mapToken(root.dummyERC1155.target, child.dummyERC1155.target, ERC1155Type)
  await child.childChainManager.mapToken(root.dummyERC1155.target, child.dummyERC1155.target)

  const MintableERC1155Type = await root.mintableERC1155Predicate.TOKEN_TYPE()
  await root.mintableERC1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(MintableERC1155Type, root.mintableERC1155Predicate.target)
  await root.rootChainManager.mapToken(root.dummyMintableERC1155.target, child.dummyMintableERC1155.target, MintableERC721Type)
  await child.childChainManager.mapToken(root.dummyMintableERC1155.target, child.dummyMintableERC1155.target)

  await root.dummyMintableERC1155.grantRole(PREDICATE_ROLE, root.mintableERC1155Predicate.target)

  const ChainExitERC1155Type = await root.chainExitERC1155Predicate.TOKEN_TYPE()
  await root.chainExitERC1155Predicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(ChainExitERC1155Type, root.chainExitERC1155Predicate.target)

  await root.dummyMintableERC1155.grantRole(PREDICATE_ROLE, root.chainExitERC1155Predicate.target)

  const EtherType = await root.etherPredicate.TOKEN_TYPE()
  await root.etherPredicate.grantRole(MANAGER_ROLE, root.rootChainManager.target)
  await root.rootChainManager.registerPredicate(EtherType, root.etherPredicate.target)
  await root.rootChainManager.mapToken(etherAddress, child.maticWETH.target, EtherType)
  await child.childChainManager.mapToken(etherAddress, child.maticWETH.target)

  return { root, child }
}

export const deployPotatoContracts = async (accounts) => {
  // Deploy POS portal contracts
  const RootChainManager = await ethers.getContractFactory("RootChainManager");
  const rootChainManagerLogic = await RootChainManager.deploy();
  await rootChainManagerLogic.waitForDeployment();

  const RootChainManagerProxy = await ethers.getContractFactory("RootChainManagerProxy");
  const rootChainManagerProxy = await RootChainManagerProxy.deploy("0x0000000000000000000000000000000000000000");
  await rootChainManagerProxy.waitForDeployment();

  const rootChainManager = RootChainManager.attach(rootChainManagerProxy.target);
  await rootChainManagerProxy.updateAndCall(
    rootChainManagerLogic.target,
    rootChainManagerLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const DummyStateSender = await ethers.getContractFactory("DummyStateSender");
  const stateSender = await DummyStateSender.deploy();
  await stateSender.waitForDeployment();

  const ERC20Predicate = await ethers.getContractFactory("ERC20Predicate");
  const erc20PredicateLogic = await ERC20Predicate.deploy();
  await erc20PredicateLogic.waitForDeployment();

  const ERC20PredicateProxy = await ethers.getContractFactory("ERC20PredicateProxy");
  const erc20PredicateProxy = await ERC20PredicateProxy.deploy("0x0000000000000000000000000000000000000000");
  await erc20PredicateProxy.waitForDeployment();

  const erc20Predicate = ERC20Predicate.attach(erc20PredicateProxy.target);
  await erc20PredicateProxy.updateAndCall(
    erc20PredicateLogic.target,
    erc20PredicateLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  const ChildChainManager = await ethers.getContractFactory("ChildChainManager");
  const childChainManagerLogic = await ChildChainManager.deploy();
  await childChainManagerLogic.waitForDeployment();

  const ChildChainManagerProxy = await ethers.getContractFactory("ChildChainManagerProxy");
  const childChainManagerProxy = await ChildChainManagerProxy.deploy("0x0000000000000000000000000000000000000000");
  await childChainManagerProxy.waitForDeployment();

  const childChainManager = ChildChainManager.attach(childChainManagerProxy.target);
  await childChainManagerProxy.updateAndCall(
    childChainManagerLogic.target,
    childChainManagerLogic.interface.encodeFunctionData("initialize", [accounts[0]])
  );

  // Read constants
  const MANAGER_ROLE = await erc20Predicate.MANAGER_ROLE();
  const ERC20Type = await erc20Predicate.TOKEN_TYPE();

  // Set values on POS portal contracts
  await rootChainManager.setStateSender(stateSender.target);
  await rootChainManager.setChildChainManagerAddress(childChainManager.target);
  await erc20Predicate.grantRole(MANAGER_ROLE, rootChainManager.target);
  await rootChainManager.registerPredicate(ERC20Type, erc20Predicate.target);

  // Deploy potato contracts
  const RootPotatoToken = await ethers.getContractFactory("RootPotatoToken");
  const rootPotatoToken = await RootPotatoToken.deploy();
  await rootPotatoToken.waitForDeployment();

  const ChildPotatoToken = await ethers.getContractFactory("ChildPotatoToken");
  const childPotatoToken = await ChildPotatoToken.deploy(childChainManager.target);
  await childPotatoToken.waitForDeployment();

  const ChildPotatoFarm = await ethers.getContractFactory("ChildPotatoFarm");
  const childPotatoFarm = await ChildPotatoFarm.deploy(childPotatoToken.target);
  await childPotatoFarm.waitForDeployment();

  const ChildPotatoMigrator = await ethers.getContractFactory("ChildPotatoMigrator");
  const childPotatoMigrator = await ChildPotatoMigrator.deploy(
    childPotatoToken.target,
    childPotatoFarm.target
  );
  await childPotatoMigrator.waitForDeployment();

  const RootPotatoMigrator = await ethers.getContractFactory("RootPotatoMigrator");
  const rootPotatoMigrator = await RootPotatoMigrator.deploy(
    stateSender.target,
    rootPotatoToken.target,
    rootChainManager.target,
    erc20Predicate.target,
    childPotatoMigrator.target
  );
  await rootPotatoMigrator.waitForDeployment();

  // Map potato tokens
  await rootChainManager.mapToken(rootPotatoToken.target, childPotatoToken.target, ERC20Type);
  await childChainManager.mapToken(rootPotatoToken.target, childPotatoToken.target);

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
  };
};

export const deployFreshRootTunnelContracts = async () => {
  const TestRootTunnel = await ethers.getContractFactory("TestRootTunnel");
  const testRootTunnel = await TestRootTunnel.deploy();
  await testRootTunnel.waitForDeployment();

  const DummyStateSender = await ethers.getContractFactory("DummyStateSender");
  const dummyStateSender = await DummyStateSender.deploy();
  await dummyStateSender.waitForDeployment();

  const MockCheckpointManager = await ethers.getContractFactory("MockCheckpointManager");
  const checkpointManager = await MockCheckpointManager.deploy();
  await checkpointManager.waitForDeployment();

  return {
    testRootTunnel,
    dummyStateSender,
    checkpointManager
  };
};

export const deployFreshChildTunnelContracts = async () => {
  const TestChildTunnel = await ethers.getContractFactory("TestChildTunnel");
  const testChildTunnel = await TestChildTunnel.deploy();
  await testChildTunnel.waitForDeployment();

  return {
    testChildTunnel
  };
};

export const deployInitializedTunnelContracts = async () => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootTunnelContracts(),
    deployFreshChildTunnelContracts()
  ])

  await root.testRootTunnel.setCheckpointManager(root.checkpointManager.target)
  await root.testRootTunnel.setStateSender(root.dummyStateSender.target)
  await root.testRootTunnel.setChildTunnel(child.testChildTunnel.target)

  return { root, child }
}
