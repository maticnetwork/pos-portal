const bluebird = require('bluebird')

const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const RLPReader = artifacts.require('RLPReader')

const RootChainManager = artifacts.require('RootChainManager')
const DummyStateSender = artifacts.require('DummyStateSender')
const DummyToken = artifacts.require('DummyToken')
const WETH = artifacts.require('WETH')

const utils = require('./utils')

const libDeps = [
  {
    lib: Merkle,
    contracts: [RootChainManager]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [RootChainManager]
  },
  {
    lib: RLPReader,
    contracts: [RootChainManager]
  }
]

module.exports = async(deployer) => {
  console.log('linking libs...')
  await bluebird.map(libDeps, async e => {
    await deployer.deploy(e.lib)
    deployer.link(e.lib, e.contracts)
  })

  console.log('deploying contracts...')
  await deployer.deploy(RootChainManager)
  await deployer.deploy(DummyStateSender)
  await deployer.deploy(DummyToken, 'Dummy Root Token', 'DUMMY')
  await deployer.deploy(WETH)

  const contractAddresses = utils.getContractAddresses()
  contractAddresses.root.RootChainManager = RootChainManager.address
  contractAddresses.root.DummyStateSender = DummyStateSender.address
  contractAddresses.root.DummyToken = DummyToken.address
  contractAddresses.root.WETH = WETH.address
  utils.writeContractAddresses(contractAddresses)
}
