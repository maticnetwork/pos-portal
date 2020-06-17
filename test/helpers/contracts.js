import { rootRPC, childRPC } from './constants'

const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const DummyStateSender = artifacts.require('DummyStateSender')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const EtherPredicate = artifacts.require('EtherPredicate')
const DummyERC20 = artifacts.require('DummyERC20')
const DummyERC721 = artifacts.require('DummyERC721')
const DummyERC1155 = artifacts.require('DummyERC1155')
const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const MaticWETH = artifacts.require('MaticWETH')

// contracts on root chain
RootChainManager.web3.currentProvider.host = rootRPC
RootChainManagerProxy.web3.currentProvider.host = rootRPC
DummyStateSender.web3.currentProvider.host = rootRPC
ERC20Predicate.web3.currentProvider.host = rootRPC
ERC721Predicate.web3.currentProvider.host = rootRPC
ERC1155Predicate.web3.currentProvider.host = rootRPC
EtherPredicate.web3.currentProvider.host = rootRPC
DummyERC20.web3.currentProvider.host = rootRPC
DummyERC721.web3.currentProvider.host = rootRPC
DummyERC1155.web3.currentProvider.host = rootRPC

// contracts on child chain
ChildChainManager.web3.currentProvider.host = childRPC
ChildChainManagerProxy.web3.currentProvider.host = childRPC
ChildERC20.web3.currentProvider.host = childRPC
ChildERC721.web3.currentProvider.host = childRPC
ChildERC1155.web3.currentProvider.host = childRPC
MaticWETH.web3.currentProvider.host = childRPC

export default {
  RootChainManager,
  RootChainManagerProxy,
  DummyStateSender,
  ERC20Predicate,
  ERC721Predicate,
  ERC1155Predicate,
  EtherPredicate,
  DummyERC20,
  DummyERC721,
  DummyERC1155,
  ChildChainManager,
  ChildChainManagerProxy,
  ChildERC20,
  ChildERC721,
  ChildERC1155,
  MaticWETH
}
