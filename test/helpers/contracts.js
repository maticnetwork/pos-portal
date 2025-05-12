import { rootRPC, childRPC } from './constants.js';

// Providers for root and child chains
const rootProvider = new ethers.JsonRpcProvider(rootRPC);
const childProvider = new ethers.JsonRpcProvider(childRPC);

// Helper function to get contract instances
const getContractInstance = async (contractName, address, provider) => {
  return await ethers.getContractAt(contractName, address, provider);
};

// Exported function to initialize all contracts
export const initializeContracts = async () => {
  // Root chain contracts
  const MockCheckpointManager = await getContractInstance('MockCheckpointManager', '0xMockCheckpointManagerAddress', rootProvider);
  const RootChainManager = await getContractInstance('RootChainManager', '0xRootChainManagerAddress', rootProvider);
  const RootChainManagerProxy = await getContractInstance('RootChainManagerProxy', '0xRootChainManagerProxyAddress', rootProvider);
  const ExitPayloadReaderTest = await getContractInstance('ExitPayloadReaderTest', '0xExitPayloadReaderTestAddress', rootProvider);
  const DummyStateSender = await getContractInstance('DummyStateSender', '0xDummyStateSenderAddress', rootProvider);
  const ERC20Predicate = await getContractInstance('ERC20Predicate', '0xERC20PredicateAddress', rootProvider);
  const ERC20PredicateProxy = await getContractInstance('ERC20PredicateProxy', '0xERC20PredicateProxyAddress', rootProvider);
  const MintableERC20Predicate = await getContractInstance('MintableERC20Predicate', '0xMintableERC20PredicateAddress', rootProvider);
  const MintableERC20PredicateProxy = await getContractInstance('MintableERC20PredicateProxy', '0xMintableERC20PredicateProxyAddress', rootProvider);
  const ERC721Predicate = await getContractInstance('ERC721Predicate', '0xERC721PredicateAddress', rootProvider);
  const ERC721PredicateProxy = await getContractInstance('ERC721PredicateProxy', '0xERC721PredicateProxyAddress', rootProvider);
  const MintableERC721Predicate = await getContractInstance('MintableERC721Predicate', '0xMintableERC721PredicateAddress', rootProvider);
  const MintableERC721PredicateProxy = await getContractInstance('MintableERC721PredicateProxy', '0xMintableERC721PredicateProxyAddress', rootProvider);
  const ERC1155Predicate = await getContractInstance('ERC1155Predicate', '0xERC1155PredicateAddress', rootProvider);
  const ERC1155PredicateProxy = await getContractInstance('ERC1155PredicateProxy', '0xERC1155PredicateProxyAddress', rootProvider);
  const MintableERC1155Predicate = await getContractInstance('MintableERC1155Predicate', '0xMintableERC1155PredicateAddress', rootProvider);
  const MintableERC1155PredicateProxy = await getContractInstance('MintableERC1155PredicateProxy', '0xMintableERC1155PredicateProxyAddress', rootProvider);
  const ChainExitERC1155Predicate = await getContractInstance('ChainExitERC1155Predicate', '0xChainExitERC1155PredicateAddress', rootProvider);
  const ChainExitERC1155PredicateProxy = await getContractInstance('ChainExitERC1155PredicateProxy', '0xChainExitERC1155PredicateProxyAddress', rootProvider);
  const EtherPredicate = await getContractInstance('EtherPredicate', '0xEtherPredicateAddress', rootProvider);
  const EtherPredicateProxy = await getContractInstance('EtherPredicateProxy', '0xEtherPredicateProxyAddress', rootProvider);
  const DummyERC20 = await getContractInstance('DummyERC20', '0xDummyERC20Address', rootProvider);
  const DummyMintableERC20 = await getContractInstance('DummyMintableERC20', '0xDummyMintableERC20Address', rootProvider);
  const DummyERC721 = await getContractInstance('DummyERC721', '0xDummyERC721Address', rootProvider);
  const DummyMintableERC721 = await getContractInstance('DummyMintableERC721', '0xDummyMintableERC721Address', rootProvider);
  const DummyERC1155 = await getContractInstance('DummyERC1155', '0xDummyERC1155Address', rootProvider);
  const DummyMintableERC1155 = await getContractInstance('DummyMintableERC1155', '0xDummyMintableERC1155Address', rootProvider);
  const TestRootTunnel = await getContractInstance('TestRootTunnel', '0xTestRootTunnelAddress', rootProvider);
  const RootPotatoMigrator = await getContractInstance('RootPotatoMigrator', '0xRootPotatoMigratorAddress', rootProvider);
  const RootPotatoToken = await getContractInstance('RootPotatoToken', '0xRootPotatoTokenAddress', rootProvider);

  // Child chain contracts
  const ChildChainManager = await getContractInstance('ChildChainManager', '0xChildChainManagerAddress', childProvider);
  const ChildChainManagerProxy = await getContractInstance('ChildChainManagerProxy', '0xChildChainManagerProxyAddress', childProvider);
  const ChildERC20 = await getContractInstance('ChildERC20', '0xChildERC20Address', childProvider);
  const ChildMintableERC20 = await getContractInstance('ChildMintableERC20', '0xChildMintableERC20Address', childProvider);
  const UChildERC20 = await getContractInstance('UChildERC20', '0xUChildERC20Address', childProvider);
  const UChildERC20Proxy = await getContractInstance('UChildERC20Proxy', '0xUChildERC20ProxyAddress', childProvider);
  const TestUChildERC20 = await getContractInstance('TestUChildERC20', '0xTestUChildERC20Address', childProvider);
  const UChildDAI = await getContractInstance('UChildDAI', '0xUChildDAIAddress', childProvider);
  const ChildERC721 = await getContractInstance('ChildERC721', '0xChildERC721Address', childProvider);
  const ChildMintableERC721 = await getContractInstance('ChildMintableERC721', '0xChildMintableERC721Address', childProvider);
  const ChildERC1155 = await getContractInstance('ChildERC1155', '0xChildERC1155Address', childProvider);
  const ChildMintableERC1155 = await getContractInstance('ChildMintableERC1155', '0xChildMintableERC1155Address', childProvider);
  const MaticWETH = await getContractInstance('MaticWETH', '0xMaticWETHAddress', childProvider);
  const TestChildTunnel = await getContractInstance('TestChildTunnel', '0xTestChildTunnelAddress', childProvider);
  const IStateReceiver = await getContractInstance('IStateReceiver', '0xIStateReceiverAddress', childProvider);
  const ChildPotatoFarm = await getContractInstance('ChildPotatoFarm', '0xChildPotatoFarmAddress', childProvider);
  const ChildPotatoMigrator = await getContractInstance('ChildPotatoMigrator', '0xChildPotatoMigratorAddress', childProvider);
  const ChildPotatoToken = await getContractInstance('ChildPotatoToken', '0xChildPotatoTokenAddress', childProvider);

  return {
    MockCheckpointManager,
    RootChainManager,
    RootChainManagerProxy,
    ExitPayloadReaderTest,
    DummyStateSender,
    ERC20Predicate,
    ERC20PredicateProxy,
    MintableERC20Predicate,
    MintableERC20PredicateProxy,
    ERC721Predicate,
    ERC721PredicateProxy,
    MintableERC721Predicate,
    MintableERC721PredicateProxy,
    ERC1155Predicate,
    ERC1155PredicateProxy,
    MintableERC1155Predicate,
    MintableERC1155PredicateProxy,
    ChainExitERC1155Predicate,
    ChainExitERC1155PredicateProxy,
    EtherPredicate,
    EtherPredicateProxy,
    DummyERC20,
    DummyMintableERC20,
    DummyERC721,
    DummyMintableERC721,
    DummyERC1155,
    DummyMintableERC1155,
    TestRootTunnel,
    RootPotatoMigrator,
    RootPotatoToken,
    ChildChainManager,
    ChildChainManagerProxy,
    ChildERC20,
    ChildMintableERC20,
    UChildERC20,
    UChildERC20Proxy,
    TestUChildERC20,
    UChildDAI,
    ChildERC721,
    ChildMintableERC721,
    ChildERC1155,
    ChildMintableERC1155,
    MaticWETH,
    TestChildTunnel,
    IStateReceiver,
    ChildPotatoFarm,
    ChildPotatoMigrator,
    ChildPotatoToken,
  };
};
