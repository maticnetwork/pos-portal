import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'

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
      contracts = await deployer.deployFreshChildContracts()
    })

    it('Can set rootToChildToken map', async() => {
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
    const depositForUser = mockValues.addresses[4]
    const syncId = mockValues.numbers[0]
    let contracts
    let dummyChildToken
    let dummyRootToken
    let childChainManager
    let oldAccountBalance
    let byteData
    let stateReceiveTx
    let depositedLog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyChildToken = contracts.child.dummyToken
      dummyRootToken = contracts.root.dummyToken
      childChainManager = contracts.child.childChainManager
      oldAccountBalance = await dummyChildToken.balanceOf(depositForUser)
      byteData = encodeStateSyncerData(depositForUser, dummyRootToken.address, depositAmount)
    })

    it('Can receive state', async() => {
      stateReceiveTx = await childChainManager.onStateReceive(syncId, byteData, { from: accounts[0] })
      should.exist(stateReceiveTx)
    })

    it('Emits Deposited event', () => {
      const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
      depositedLog = logs.find(l => l.event === 'Deposited')
      should.exist(depositedLog)
    })

    describe('Correct values emitted in Deposited log', () => {
      it('Emitter address', () => {
        depositedLog.address.should.equal(
          childChainManager.address.toLowerCase()
        )
      })

      it('user', () => {
        depositedLog.args.user.should.equal(depositForUser)
      })

      it('childToken', () => {
        depositedLog.args.childToken.should.equal(dummyChildToken.address)
      })

      it('amount', () => {
        const depositedLogAmount = new BN(depositedLog.args.amount.toString())
        depositedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })
    })

    it('Deposit amount credited to account', async() => {
      const newAccountBalance = await dummyChildToken.balanceOf(depositForUser)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(depositAmount)
      )
    })
  })
})

function encodeStateSyncerData(user, rootToken, amount) {
  return '0x' +
    user.slice(2).padStart(64, '0') +
    rootToken.slice(2).padStart(64, '0') +
    amount.toString(16).padStart(64, '0')
}
