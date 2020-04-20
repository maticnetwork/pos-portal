import { rootWeb3, childWeb3 } from './constants'

const RootChainManager = artifacts.require('RootChainManager')
const DummyStateSender = artifacts.require('DummyStateSender')
const DummyToken = artifacts.require('DummyToken')
const ChildChainManager = artifacts.require('ChildChainManager')
const ChildToken = artifacts.require('ChildToken')

// contracts on root chain
RootChainManager.web3 = rootWeb3
DummyStateSender.web3 = rootWeb3
DummyToken.web3 = rootWeb3

// contracts on child chain
ChildChainManager.web3 = childWeb3
ChildToken.web3 = childWeb3

export default {
  RootChainManager,
  DummyStateSender,
  DummyToken,
  ChildChainManager,
  ChildToken
}
