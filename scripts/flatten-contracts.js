const flatten = require('truffle-flattener')
const fs = require('fs')

const contractsToFlatten = [
  {
    path: 'contracts/root/RootChainManager',
    fileName: 'RootChainManager.sol'
  },
  {
    path: 'contracts/root/RootChainManager',
    fileName: 'RootChainManagerProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC20Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC20PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC20Predicate.sol'
  },

  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC20PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC721Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC721PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC721Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC721PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC1155Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ERC1155PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC1155Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'MintableERC1155PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ChainExitERC1155Predicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'ChainExitERC1155PredicateProxy.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'EtherPredicate.sol'
  },
  {
    path: 'contracts/root/TokenPredicates',
    fileName: 'EtherPredicateProxy.sol'
  },
  {
    path: 'contracts/root/StateSender',
    fileName: 'DummyStateSender.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyERC20.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyMintableERC20.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyERC721.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyMintableERC721.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyERC1155.sol'
  },
  {
    path: 'contracts/root/RootToken',
    fileName: 'DummyMintableERC1155.sol'
  },
  {
    path: 'contracts/child/ChildChainManager',
    fileName: 'ChildChainManager.sol'
  },
  {
    path: 'contracts/child/ChildChainManager',
    fileName: 'ChildChainManagerProxy.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildERC20.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildMintableERC20.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildERC721.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildMintableERC721.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildERC1155.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'ChildMintableERC1155.sol'
  },
  {
    path: 'contracts/child/ChildToken',
    fileName: 'MaticWETH.sol'
  },
  {
    path: 'contracts/child/ChildToken/UpgradeableChildERC20',
    fileName: 'UChildERC20.sol'
  },
  {
    path: 'contracts/child/ChildToken/UpgradeableChildERC20',
    fileName: 'UChildERC20Proxy.sol'
  },
  {
    path: 'contracts/tunnel',
    fileName: 'BaseRootTunnel.sol'
  },
  {
    path: 'contracts/tunnel',
    fileName: 'BaseChildTunnel.sol'
  },
  {
    path: 'contracts/tunnel',
    fileName: 'RootTunnel.sol'
  },
  {
    path: 'contracts/tunnel',
    fileName: 'ChildTunnel.sol'
  }
]

contractsToFlatten.forEach(async (c) => {
  const source = `./${c.path}/${c.fileName}`
  const dest = `./flat/${c.fileName}`
  const flat = await flatten([source])
  fs.writeFileSync(dest, flat)
})
