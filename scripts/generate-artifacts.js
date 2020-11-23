const fs = require('fs')

const artifactsToGenerate = [
  'ChildChainManager.json',
  'ChildERC1155.json',
  'ChildERC20.json',
  'ChildERC721.json',
  'ChildMintableERC721.json',
  'DummyERC1155.json',
  'DummyERC20.json',
  'DummyERC721.json',
  'DummyMintableERC721.json',
  'MaticWETH.json',
  'RootChainManager.json'
]

artifactsToGenerate.forEach(a => {
  const source = `build/contracts/${a}`
  const dest = `artifacts/${a}`
  const abi = JSON.parse(fs.readFileSync(source)).abi
  fs.writeFileSync(dest, JSON.stringify({ abi }) + '\n')
})
