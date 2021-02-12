/* global artifacts */

import { rootRPC, childRPC } from './constants'
import Web3 from 'web3'

const MockCheckpointManager = artifacts.require('MockCheckpointManager')
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
const RootPotatoMigrator = artifacts.require('RootPotatoMigrator')
const RootPotatoToken = artifacts.require('RootPotatoToken')

const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildMintableERC20 = artifacts.require('ChildMintableERC20')
const UChildERC20 = artifacts.require('UChildERC20')
const UChildERC20Proxy = artifacts.require('UChildERC20Proxy')
const TestUChildERC20 = artifacts.require('TestUChildERC20')
const UChildDAI = artifacts.require('UChildDAI')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildMintableERC721 = artifacts.require('ChildMintableERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const ChildMintableERC1155 = artifacts.require('ChildMintableERC1155')
const MaticWETH = artifacts.require('MaticWETH')
const TestChildTunnel = artifacts.require('TestChildTunnel')
const IStateReceiver = artifacts.require('IStateReceiver')
const ChildPotatoFarm = artifacts.require('ChildPotatoFarm')
const ChildPotatoMigrator = artifacts.require('ChildPotatoMigrator')
const ChildPotatoToken = artifacts.require('ChildPotatoToken')

const rootProvider = new Web3.providers.HttpProvider(rootRPC)
const childProvider = new Web3.providers.HttpProvider(childRPC)

export const rootWeb3 = new Web3(rootProvider)
rootWeb3.setNetworkType = () => {} // Truffle work around for Web3Shim
export const childWeb3 = new Web3(childProvider)
childWeb3.setNetworkType = () => {} // Truffle work around for Web3Shim

// set web3 and provider
const setWeb3 = (contractObj, w3) => {
  contractObj.web3 = w3
  contractObj.setProvider(w3.currentProvider)
}

// contracts on root chain
setWeb3(MockCheckpointManager, rootWeb3)
setWeb3(RootChainManager, rootWeb3)
setWeb3(RootChainManagerProxy, rootWeb3)
setWeb3(DummyStateSender, rootWeb3)
setWeb3(ERC20Predicate, rootWeb3)
setWeb3(ERC20PredicateProxy, rootWeb3)
setWeb3(MintableERC20Predicate, rootWeb3)
setWeb3(MintableERC20PredicateProxy, rootWeb3)
setWeb3(ERC721Predicate, rootWeb3)
setWeb3(ERC721PredicateProxy, rootWeb3)
setWeb3(MintableERC721Predicate, rootWeb3)
setWeb3(MintableERC721PredicateProxy, rootWeb3)
setWeb3(ERC1155Predicate, rootWeb3)
setWeb3(ERC1155PredicateProxy, rootWeb3)
setWeb3(MintableERC1155Predicate, rootWeb3)
setWeb3(MintableERC1155PredicateProxy, rootWeb3)
setWeb3(EtherPredicate, rootWeb3)
setWeb3(EtherPredicateProxy, rootWeb3)
setWeb3(DummyERC20, rootWeb3)
setWeb3(DummyMintableERC20, rootWeb3)
setWeb3(DummyERC721, rootWeb3)
setWeb3(DummyMintableERC721, rootWeb3)
setWeb3(DummyERC1155, rootWeb3)
setWeb3(DummyMintableERC1155, rootWeb3)
setWeb3(TestRootTunnel, rootWeb3)
setWeb3(RootPotatoMigrator, rootWeb3)
setWeb3(RootPotatoToken, rootWeb3)

// contracts on child chain
setWeb3(ChildChainManager, childWeb3)
setWeb3(ChildChainManagerProxy, childWeb3)
setWeb3(ChildERC20, childWeb3)
setWeb3(ChildMintableERC20, childWeb3)
setWeb3(UChildERC20, childWeb3)
setWeb3(UChildERC20Proxy, childWeb3)
setWeb3(TestUChildERC20, childWeb3)
setWeb3(UChildDAI, childWeb3)
setWeb3(ChildERC721, childWeb3)
setWeb3(ChildMintableERC721, childWeb3)
setWeb3(ChildERC1155, childWeb3)
setWeb3(ChildMintableERC1155, childWeb3)
setWeb3(MaticWETH, childWeb3)
setWeb3(TestChildTunnel, childWeb3)
setWeb3(IStateReceiver, childWeb3)
setWeb3(ChildPotatoFarm, childWeb3)
setWeb3(ChildPotatoMigrator, childWeb3)
setWeb3(ChildPotatoToken, childWeb3)

export default {
  MockCheckpointManager,
  RootChainManager,
  RootChainManagerProxy,
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
  ChildPotatoToken
}
