import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { encodeStateSyncerData } from '../helpers/utils'
const abi = require('ethers/utils/abi-coder').defaultAbiCoder

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ChildChainManager', async(accounts) => {
  describe('Map tokens', async() => {
    let contracts
    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
    })

    it('Can set rootToChildToken map', async() => {
      // 0x9fB29AAc15b9A4B7F17c3385939b007540f4d791
      const mockParent = mockValues.addresses[0]
      const mockChild = mockValues.addresses[1]
      await contracts.childChainManager.mapToken(mockParent, mockChild)
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(mockParent)
      childTokenAddress.should.equal(mockChild)
    })

    it('Can set childToRootToken map', async() => {
      const mockParent = mockValues.addresses[2]
      const mockChild = mockValues.addresses[3]
      await contracts.childChainManager.mapToken(mockParent, mockChild)
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(mockChild)
      parentTokenAddress.should.equal(mockParent)
    })
  })

  describe('Deposit tokens on receiving state', async() => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const syncId = mockValues.numbers[0]
    let contracts
    let dummyChildERC20
    let dummyRootERC20
    let childChainManager
    let oldAccountBalance
    let byteData
    let stateReceiveTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyChildERC20 = contracts.child.dummyERC20
      dummyRootERC20 = contracts.root.dummyERC20
      childChainManager = contracts.child.childChainManager
      oldAccountBalance = await dummyChildERC20.balanceOf(depositReceiver)
    })

    it('Can receive deposit sync', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const syncData = abi.encode(['address', 'address', 'bytes'], [depositReceiver, dummyRootERC20.address, depositData])
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      byteData = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      stateReceiveTx = await childChainManager.onStateReceive(syncId, byteData, { from: accounts[0] })
      should.exist(stateReceiveTx)
    })

    it('Deposit amount should be credited to deposit receiver', async() => {
      const newAccountBalance = await dummyChildERC20.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(depositAmount)
      )
    })
  })
})
