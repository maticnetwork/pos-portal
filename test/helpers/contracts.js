import { rootRPC, childRPC } from './constants'
import Web3 from 'web3'

const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const DummyStateSender = artifacts.require('DummyStateSender')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC20PredicateProxy = artifacts.require('ERC20PredicateProxy')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC721PredicateProxy = artifacts.require('ERC721PredicateProxy')
const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const ERC1155PredicateProxy = artifacts.require('ERC1155PredicateProxy')
const EtherPredicate = artifacts.require('EtherPredicate')
const EtherPredicateProxy = artifacts.require('EtherPredicateProxy')
const DummyERC20 = artifacts.require('DummyERC20')
const DummyERC721 = artifacts.require('DummyERC721')
const DummyERC1155 = artifacts.require('DummyERC1155')
const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const MaticWETH = artifacts.require('MaticWETH')

const rootProvider = new Web3.providers.HttpProvider(rootRPC)
const childProvider = new Web3.providers.HttpProvider(childRPC)

const rootWeb3 = new Web3(rootProvider)
const childWeb3 = new Web3(childProvider)

// TODO: use different network for root and child contracts
// // contracts on root chain
// RootChainManager.web3 = rootWeb3
// RootChainManagerProxy.web3 = rootWeb3
// DummyStateSender.web3 = rootWeb3
// ERC20Predicate.web3 = rootWeb3
// ERC721Predicate.web3 = rootWeb3
// ERC1155Predicate.web3 = rootWeb3
// EtherPredicate.web3 = rootWeb3
// DummyERC20.web3 = rootWeb3
// DummyERC721.web3 = rootWeb3
// DummyERC1155.web3 = rootWeb3

// // contracts on child chain
// ChildChainManager.web3 = childWeb3
// ChildChainManagerProxy.web3 = childWeb3
// ChildERC20.web3 = childWeb3
// ChildERC721.web3 = childWeb3
// ChildERC1155.web3 = childWeb3
// MaticWETH.web3 = childWeb3

export default {
  RootChainManager,
  RootChainManagerProxy,
  DummyStateSender,
  ERC20Predicate,
  ERC20PredicateProxy,
  ERC721Predicate,
  ERC721PredicateProxy,
  ERC1155Predicate,
  ERC1155PredicateProxy,
  EtherPredicate,
  EtherPredicateProxy,
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
