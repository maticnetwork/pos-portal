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

contract('RootChainManager', async(accounts) => {
  describe('Set values', async() => {
    let contracts
    before(async() => {
      contracts = await deployer.deployFreshRootContracts()
    })

    it('Can set stateSenderAddress', async() => {
      const mockStateSenderAddress = mockValues.addresses[0]
      await contracts.rootChainManager.setStateSender(mockStateSenderAddress)
      const stateSenderAddress = await contracts.rootChainManager.stateSenderAddress()
      stateSenderAddress.should.equal(mockStateSenderAddress)
    })

    it('Can set childChainManagerAddress', async() => {
      const mockChildChainManagerAddress = mockValues.addresses[1]
      await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)
      const childChainManagerAddress = await contracts.rootChainManager.childChainManagerAddress()
      childChainManagerAddress.should.equal(mockChildChainManagerAddress)
    })

    it('Can set WETHAddress', async() => {
      const mockWETHAddress = mockValues.addresses[2]
      await contracts.rootChainManager.setWETHAddress(mockWETHAddress)
      const WETHAddress = await contracts.rootChainManager.WETHAddress()
      WETHAddress.should.equal(mockWETHAddress)
    })

    it('Can set rootToChildToken map', async() => {
      const mockParent = mockValues.addresses[3]
      const mockChild = mockValues.addresses[4]
      await contracts.rootChainManager.mapToken(mockParent, mockChild)
      const childTokenAddress = await contracts.rootChainManager.rootToChildToken(mockParent)
      childTokenAddress.should.equal(mockChild)
    })

    it('Can set childToRootToken map', async() => {
      const mockParent = mockValues.addresses[5]
      const mockChild = mockValues.addresses[6]
      await contracts.rootChainManager.mapToken(mockParent, mockChild)
      const parentTokenAddress = await contracts.rootChainManager.childToRootToken(mockChild)
      parentTokenAddress.should.equal(mockParent)
    })
  })

  describe('deposit', async() => {
    const depositAmount = mockValues.amounts[0]
    let contracts
    let dummyToken
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyToken = contracts.root.dummyToken
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = await dummyToken.balanceOf(accounts[0])
      oldContractBalance = await dummyToken.balanceOf(rootChainManager.address)
    })

    it('Account has balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Can approve and deposit', async() => {
      await dummyToken.approve(rootChainManager.address, depositAmount)
      depositTx = await rootChainManager.deposit(dummyToken.address, depositAmount)
      should.exist(depositTx)
    })

    it('Emits Locked log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'Locked')
      should.exist(lockedLog)
    })

    describe('Correct values emitted in Locked log', () => {
      it('Emitter address', () => {
        lockedLog.address.should.equal(
          rootChainManager.address.toLowerCase()
        )
      })

      it('amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })

      it('user', () => {
        lockedLog.args.user.should.equal(accounts[0])
      })

      it('rootToken', () => {
        lockedLog.args.rootToken.should.equal(dummyToken.address)
      })
    })

    it('Emits StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values emitted in StateSynced log', () => {
      let data
      before(() => {
        data = decodeStateSenderData(stateSyncedlog.args.data)
      })

      it('Emitter address', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('user', () => {
        data.user.should.equal(accounts[0].toLowerCase())
      })

      it('rootToken', () => {
        data.rootToken.should.equal(dummyToken.address.toLowerCase())
      })

      it('amount', () => {
        data.amount.should.be.a.bignumber.that.equals(depositAmount)
      })

      it('contractAddress', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount deducted from account', async() => {
      const newAccountBalance = await dummyToken.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount credited to contract', async() => {
      const newContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('depositFor', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyToken
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyToken = contracts.root.dummyToken
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = await dummyToken.balanceOf(accounts[0])
      oldContractBalance = await dummyToken.balanceOf(rootChainManager.address)
    })

    it('Account has balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Can approve and deposit', async() => {
      await dummyToken.approve(rootChainManager.address, depositAmount)
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyToken.address, depositAmount)
      should.exist(depositTx)
    })

    it('Emits Locked log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'Locked')
      should.exist(lockedLog)
    })

    describe('Correct values emitted in Locked log', () => {
      it('Emitter address', () => {
        lockedLog.address.should.equal(
          rootChainManager.address.toLowerCase()
        )
      })

      it('amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })

      it('user', () => {
        lockedLog.args.user.should.equal(depositForAccount)
      })

      it('rootToken', () => {
        lockedLog.args.rootToken.should.equal(dummyToken.address)
      })
    })

    it('Emits StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values emitted in StateSynced log', () => {
      let data
      before(() => {
        data = decodeStateSenderData(stateSyncedlog.args.data)
      })

      it('Emitter address', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('user', () => {
        data.user.should.equal(depositForAccount.toLowerCase())
      })

      it('rootToken', () => {
        data.rootToken.should.equal(dummyToken.address.toLowerCase())
      })

      it('amount', () => {
        data.amount.should.be.a.bignumber.that.equals(depositAmount)
      })

      it('contractAddress', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount deducted from account', async() => {
      const newAccountBalance = await dummyToken.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount credited to contract', async() => {
      const newContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })
})

function decodeStateSenderData(data) {
  const user = '0x' + data.slice(26, 66)
  const rootToken = '0x' + data.slice(90, 130)
  const amount = new BN(data.slice(131, 194), 16)
  return { user, rootToken, amount }
}
