const ChildChainManager = artifacts.require('ChildChainManager')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildMintableERC721 = artifacts.require('ChildMintableERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const MaticWETH = artifacts.require('MaticWETH')
const utils = require('./utils')
const config = require('./config')

module.exports = async(deployer) => {
  const contractAddresses = utils.getContractAddresses()

  const ChildChainManagerInstance = await ChildChainManager.at(contractAddresses.child.ChildChainManagerProxy)
  const DummyERC20Instance = await ChildERC20.at(contractAddresses.child.DummyERC20)
  const DummyERC721Instance = await ChildERC721.at(contractAddresses.child.DummyERC721)
  const DummyMintableERC721Instance = await ChildMintableERC721.at(contractAddresses.child.DummyMintableERC721)
  const DummyERC1155Instance = await ChildERC1155.at(contractAddresses.child.DummyERC1155)
  const MaticWETHInstance = await MaticWETH.at(contractAddresses.child.MaticWETH)

  console.log('Granting STATE_SYNCER_ROLE on ChildChainManager')
  const STATE_SYNCER_ROLE = await ChildChainManagerInstance.STATE_SYNCER_ROLE()
  await ChildChainManagerInstance.grantRole(STATE_SYNCER_ROLE, config.stateReceiver)

  console.log('Mapping DummyERC20')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC20, DummyERC20Instance.address)

  console.log('Mapping DummyERC721')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC721, DummyERC721Instance.address)

  console.log('Mapping DummyMintableERC721')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC721, DummyMintableERC721Instance.address)

  console.log('Mapping DummyERC1155')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC1155, DummyERC1155Instance.address)

  console.log('Mapping WETH')
  await ChildChainManagerInstance.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', MaticWETHInstance.address)

  console.log('Granting DEPOSITOR_ROLE on DummyERC20')
  const DEPOSITOR_ROLE = await DummyERC20Instance.DEPOSITOR_ROLE()
  await DummyERC20Instance.grantRole(DEPOSITOR_ROLE, ChildChainManagerInstance.address)

  console.log('Granting DEPOSITOR_ROLE on DummyERC721')
  await DummyERC721Instance.grantRole(DEPOSITOR_ROLE, ChildChainManagerInstance.address)

  console.log('Granting DEPOSITOR_ROLE on DummyMintableERC721')
  await DummyMintableERC721Instance.grantRole(DEPOSITOR_ROLE, ChildChainManagerInstance.address)

  console.log('Granting DEPOSITOR_ROLE on DummyERC1155')
  await DummyERC1155Instance.grantRole(DEPOSITOR_ROLE, ChildChainManagerInstance.address)

  console.log('Granting DEPOSITOR_ROLE on WETH')
  await MaticWETHInstance.grantRole(DEPOSITOR_ROLE, ChildChainManagerInstance.address)
}
