import { rootNetworkId, childNetworkId } from './constants'

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
RootChainManager.setNetwork(rootNetworkId)
RootChainManagerProxy.setNetwork(rootNetworkId)
DummyStateSender.setNetwork(rootNetworkId)
ERC20Predicate.setNetwork(rootNetworkId)
ERC721Predicate.setNetwork(rootNetworkId)
ERC1155Predicate.setNetwork(rootNetworkId)
EtherPredicate.setNetwork(rootNetworkId)
DummyERC20.setNetwork(rootNetworkId)
DummyERC721.setNetwork(rootNetworkId)
DummyERC1155.setNetwork(rootNetworkId)

// contracts on child chain
ChildChainManager.setNetwork(childNetworkId)
ChildChainManagerProxy.setNetwork(childNetworkId)
ChildERC20.setNetwork(childNetworkId)
ChildERC721.setNetwork(childNetworkId)
ChildERC1155.setNetwork(childNetworkId)
MaticWETH.setNetwork(childNetworkId)

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
