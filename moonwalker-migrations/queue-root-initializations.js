const EthDeployer = require('moonwalker').default
const contractAddresses = require('../contractAddresses.json')
const config = require('./config')

let id = 28

async function deploy() {
  const qClient = await EthDeployer.getQueue()
  const deployer = new EthDeployer.Sender(qClient)

  // keccak256("MANAGER_ROLE")
  const ManagerRole = '0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08'

  // keccak256("PREDICATE_ROLE")
  const PredicateRole = '0x12ff340d0cd9c652c747ca35727e68c547d0f0bfa7758d2e77f75acef481b4f2'

  // keccak256("ERC20")
  const ERC20Type = '0x8ae85d849167ff996c04040c44924fd364217285e4cad818292c7ac37c0a345b'

  // keccak256("ERC721")
  const ERC721Type = '0x73ad2146b3d3a286642c794379d750360a2d53a3459a11b3e5d6cc900f55f44a'

  // keccak256("MintableERC721")
  const MintableERC721Type = '0xd4392723c111fcb98b073fe55873efb447bcd23cd3e49ec9ea2581930cd01ddc'

  // keccak256("ERC1155")
  const ERC1155Type = '0x973bb64086f173ec8099b7ed3d43da984f4a332e4417a08bc6a286e6402b0586'

  // keccak256("Ether")
  const EtherType = '0xa234e09165f88967a714e2a476288e4c6d88b4b69fe7c300a03190b858990bfc'

  await deployer.deploy(tx(
    'RootChainManager',
    'setStateSender',
    ['DummyStateSender'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'setChildChainManagerAddress',
    [{ value: contractAddresses.child.ChildChainManagerProxy }],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'setCheckpointManager',
    [{ value: config.plasmaRootChain }],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'ERC20Predicate',
    'grantRole',
    [{ value: ManagerRole }, 'RootChainManagerProxy'],
    'ERC20PredicateProxy'
  ))

  await deployer.deploy(tx(
    'ERC721Predicate',
    'grantRole',
    [{ value: ManagerRole }, 'RootChainManagerProxy'],
    'ERC721PredicateProxy'
  ))

  await deployer.deploy(tx(
    'MintableERC721Predicate',
    'grantRole',
    [{ value: ManagerRole }, 'RootChainManagerProxy'],
    'MintableERC721PredicateProxy'
  ))

  await deployer.deploy(tx(
    'ERC1155Predicate',
    'grantRole',
    [{ value: ManagerRole }, 'RootChainManagerProxy'],
    'ERC1155PredicateProxy'
  ))

  await deployer.deploy(tx(
    'EtherPredicate',
    'grantRole',
    [{ value: ManagerRole }, 'RootChainManagerProxy'],
    'EtherPredicateProxy'
  ))

  await deployer.deploy(tx(
    'DummyMintableERC721',
    'grantRole',
    [{ value: PredicateRole }, 'MintableERC721PredicateProxy']
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'registerPredicate',
    [{ value: ERC20Type }, 'ERC20PredicateProxy'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'registerPredicate',
    [{ value: ERC721Type }, 'ERC721PredicateProxy'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'registerPredicate',
    [{ value: MintableERC721Type }, 'MintableERC721PredicateProxy'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'registerPredicate',
    [{ value: ERC1155Type }, 'ERC1155PredicateProxy'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'registerPredicate',
    [{ value: EtherType }, 'EtherPredicateProxy'],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'mapToken',
    [
      'DummyERC20',
      { value: contractAddresses.child.DummyERC20 },
      { value: ERC20Type }
    ],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'mapToken',
    [
      'DummyERC721',
      { value: contractAddresses.child.DummyERC721 },
      { value: ERC721Type }
    ],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'mapToken',
    [
      'DummyMintableERC721',
      { value: contractAddresses.child.DummyMintableERC721 },
      { value: MintableERC721Type }
    ],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'mapToken',
    [
      'DummyERC1155',
      { value: contractAddresses.child.DummyERC1155 },
      { value: ERC1155Type }
    ],
    'RootChainManagerProxy'
  ))

  await deployer.deploy(tx(
    'RootChainManager',
    'mapToken',
    [
      { value: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
      { value: contractAddresses.child.MaticWETH },
      { value: EtherType }
    ],
    'RootChainManagerProxy'
  ))
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

deploy()
