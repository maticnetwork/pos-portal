import { rootNetworkId, childNetworkId } from './constants'

const RootChainManager = artifacts.require('RootChainManager')
const DummyStateSender = artifacts.require('DummyStateSender')
const DummyToken = artifacts.require('DummyToken')
const ChildChainManager = artifacts.require('ChildChainManager')
const ChildToken = artifacts.require('ChildToken')

// contracts on root chain
RootChainManager.setNetwork(rootNetworkId)
DummyStateSender.setNetwork(rootNetworkId)
DummyToken.setNetwork(rootNetworkId)

// contracts on child chain
ChildChainManager.setNetwork(childNetworkId)
ChildToken.setNetwork(childNetworkId)

export default {
  RootChainManager,
  DummyStateSender,
  DummyToken,
  ChildChainManager,
  ChildToken
}
