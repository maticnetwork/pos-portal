const EthDeployer = require('moonwalker').default
const config = require('./config')

const RootChainManager = artifacts.require('RootChainManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const EtherPredicate = artifacts.require('EtherPredicate')

let id = 0

async function deploy() {
  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  const rootChainManager = await RootChainManager.new()
  const erc20Predicate = await ERC20Predicate.new()
  const erc721Predicate = await ERC721Predicate.new()
  const mintableERC721Predicate = await MintableERC721Predicate.new()
  const erc1155Predicate = await ERC1155Predicate.new()
  const etherPredicate = await EtherPredicate.new()

  // Libs
  await deployer.deploy(transformArtifact('Merkle'))
  await deployer.deploy(transformArtifact('MerklePatriciaProof'))
  await deployer.deploy(transformArtifact('RLPReader'))
  await deployer.deploy(transformArtifact('SafeERC20'))
  await deployer.deploy(transformArtifact('SafeMath'))

  await deployer.deploy(transformArtifact('RootChainManager'))
  await deployer.deploy(transformArtifact('RootChainManagerProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'RootChainManagerProxy',
    'updateAndCall',
    [
      'RootChainManager',
      { value: rootChainManager.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('ERC20Predicate'))
  await deployer.deploy(transformArtifact('ERC20PredicateProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'ERC20PredicateProxy',
    'updateAndCall',
    [
      'ERC20Predicate',
      { value: erc20Predicate.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('ERC721Predicate'))
  await deployer.deploy(transformArtifact('ERC721PredicateProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'ERC721PredicateProxy',
    'updateAndCall',
    [
      'ERC721Predicate',
      { value: erc721Predicate.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('MintableERC721Predicate'))
  await deployer.deploy(transformArtifact('MintableERC721PredicateProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'MintableERC721PredicateProxy',
    'updateAndCall',
    [
      'MintableERC721Predicate',
      { value: mintableERC721Predicate.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('ERC1155Predicate'))
  await deployer.deploy(transformArtifact('ERC1155PredicateProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'ERC1155PredicateProxy',
    'updateAndCall',
    [
      'ERC1155Predicate',
      { value: erc1155Predicate.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('EtherPredicate'))
  await deployer.deploy(transformArtifact('EtherPredicateProxy', [{ value: '0x0000000000000000000000000000000000000000' }]))
  await deployer.deploy(tx(
    'EtherPredicateProxy',
    'updateAndCall',
    [
      'EtherPredicate',
      { value: etherPredicate.contract.methods.initialize(config.from).encodeABI() }
    ]
  ))

  await deployer.deploy(transformArtifact('DummyStateSender'))
  await deployer.deploy(transformArtifact('DummyERC20', [{ value: 'Dummy ERC20' }, { value: 'DERC20' }]))
  await deployer.deploy(transformArtifact('DummyERC721', [{ value: 'Dummy ERC721' }, { value: 'DERC721' }]))
  await deployer.deploy(transformArtifact('DummyMintableERC721', [{ value: 'Dummy Mintable ERC721' }, { value: 'DMERC721' }]))
  await deployer.deploy(transformArtifact('DummyERC1155', [{ value: 'Dummy ERC1155' }]))
}

function tx(contract, method, args, addressArtifact) {
  return JSON.stringify({
    contract, // abi
    addressArtifact, // allowed to be undefined
    method,
    args,
    id: id++,
    type: 'transaction'
  })
}

function transformArtifact(contract, args = []) {
  const res = {
    contract, // abi
    args,
    id: id++,
    type: 'deploy'
  }
  return JSON.stringify(res)
}

function wait(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

module.exports = async function(callback) {
  try {
    await deploy()
    await wait(3000) // otherwise the tasks are not queued
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
