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

const web3Root = new web3.constructor(
  new web3.providers.HttpProvider(rootRPC)
)
const web3Child = new web3.constructor(
  new web3.providers.HttpProvider(childRPC)
)

// contracts on root chain
RootChainManager.web3 = web3Root
RootChainManagerProxy.web3 = web3Root
DummyStateSender.web3 = web3Root
ERC20Predicate.web3 = web3Root
ERC721Predicate.web3 = web3Root
ERC1155Predicate.web3 = web3Root
EtherPredicate.web3 = web3Root
DummyERC20.web3 = web3Root
DummyERC721.web3 = web3Root
DummyERC1155.web3 = web3Root

// contracts on child chain
ChildChainManager.web3 = web3Child
ChildChainManagerProxy.web3 = web3Child
ChildERC20.web3 = web3Child
ChildERC721.web3 = web3Child
ChildERC1155.web3 = web3Child
MaticWETH.web3 = web3Child

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
