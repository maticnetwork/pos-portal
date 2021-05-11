const fs = require('fs')

const artifactsToGenerate = [
  'ChildChainManager.json',
  'ChildERC20.json',
  'ChildERC721.json',
  'ChildERC1155.json',
  'ChildMintableERC20.json',
  'ChildMintableERC721.json',
  'ChildMintableERC1155.json',
  'DummyERC20.json',
  'DummyERC721.json',
  'DummyERC1155.json',
  'DummyMintableERC20.json',
  'DummyMintableERC721.json',
  'DummyMintableERC1155.json',
  'MaticWETH.json',
  'RootChainManager.json',
  'BaseRootTunnel.json',
  'BaseChildTunnel.json',
  'RootTunnel.json',
  'ChildTunnel.json',
  'ChainExitERC1155Predicate.json',
  'ChainExitERC1155PredicateProxy.json'
]

artifactsToGenerate.forEach(a => {
  const source = `build/contracts/${a}`
  const dest = `artifacts/${a}`
  const abi = JSON.parse(fs.readFileSync(source)).abi
  fs.writeFileSync(dest, JSON.stringify({ abi }) + '\n')
})
