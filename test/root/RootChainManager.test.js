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
  let contracts

  describe('Set values', async() => {
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

  describe('Deposit tokens', async() => {
    before(async() => {
      contracts = await deployer.deployInitializedContracts()
    })

    it('Can deposit', async() => {
      const dummyToken = contracts.root.dummyToken
      const rootChainManager = contracts.root.rootChainManager
      const oldAccountBalance = await dummyToken.balanceOf(accounts[0])
      const oldContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      const depositAmount = mockValues.amounts[0]

      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)

      await dummyToken.approve(rootChainManager.address, depositAmount)
      const depositTx = await rootChainManager.deposit(dummyToken.address, depositAmount)
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      const depositedLog = logs.find(l => l.event === 'Deposited')
      const stateSyncedlog = logs.find(l => l.event === 'StateSynced')

      should.exist(depositedLog)
      should.exist(stateSyncedlog)

      const depositedLogAmount = new BN(depositedLog.args.amount.toString())
      depositedLogAmount.should.be.bignumber.that.equals(depositAmount)
      depositedLog.args.user.should.equal(accounts[0])
      depositedLog.args.rootToken.should.equal(dummyToken.address)
      depositedLog.address.should.equal(
        rootChainManager.address.toLowerCase()
      )

      const data = decodeStateSenderData(stateSyncedlog.args.data)
      data.user.should.equal(accounts[0].toLowerCase())
      data.rootToken.should.equal(dummyToken.address.toLowerCase())
      data.amount.should.be.a.bignumber.that.equals(depositAmount)
      stateSyncedlog.args.contractAddress.should.equal(
        contracts.child.childChainManager.address
      )
      stateSyncedlog.address.should.equal(
        contracts.root.dummyStateSender.address.toLowerCase()
      )

      const newAccountBalance = await dummyToken.balanceOf(accounts[0])
      const newContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })

    it('Can depositFor', async() => {
      const dummyToken = contracts.root.dummyToken
      const rootChainManager = contracts.root.rootChainManager
      const oldAccountBalance = await dummyToken.balanceOf(accounts[0])
      const oldContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      const depositAmount = mockValues.amounts[0]
      const depositForAccount = mockValues.addresses[0]

      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)

      await dummyToken.approve(rootChainManager.address, depositAmount)
      const depositTx = await rootChainManager.depositFor(depositForAccount, dummyToken.address, depositAmount)
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      const depositedLog = logs.find(l => l.event === 'Deposited')
      const stateSyncedlog = logs.find(l => l.event === 'StateSynced')

      should.exist(depositedLog)
      should.exist(stateSyncedlog)

      const depositedLogAmount = new BN(depositedLog.args.amount.toString())
      depositedLogAmount.should.be.bignumber.that.equals(depositAmount)
      depositedLog.args.user.should.equal(depositForAccount)
      depositedLog.args.rootToken.should.equal(dummyToken.address)
      depositedLog.address.should.equal(
        rootChainManager.address.toLowerCase()
      )

      const data = decodeStateSenderData(stateSyncedlog.args.data)
      data.user.should.equal(depositForAccount.toLowerCase())
      data.rootToken.should.equal(dummyToken.address.toLowerCase())
      data.amount.should.be.a.bignumber.that.equals(depositAmount)
      stateSyncedlog.args.contractAddress.should.equal(
        contracts.child.childChainManager.address
      )
      stateSyncedlog.address.should.equal(
        contracts.root.dummyStateSender.address.toLowerCase()
      )

      const newAccountBalance = await dummyToken.balanceOf(accounts[0])
      const newContractBalance = await dummyToken.balanceOf(rootChainManager.address)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
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
