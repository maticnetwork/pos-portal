import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues, etherAddress } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC20TransferLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const abi = new AbiCoder()

contract('EtherPredicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let etherPredicate
    let lockTokensTx
    let lockedLog

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should be able to receive lockTokens tx', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      lockTokensTx = await etherPredicate.lockTokens(depositor, depositReceiver, etherAddress, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedEther log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedEther')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedEther log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          etherPredicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit correct amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })

      it('Should emit correct deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })
    })
  })

  describe('lockTokens called by non manager', () => {
    const depositAmount = mockValues.amounts[3]
    const depositor = accounts[1]
    const depositReceiver = accounts[2]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let etherPredicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should revert with correct reason', async() => {
      await expectRevert(
        etherPredicate.lockTokens(depositor, depositReceiver, etherAddress, depositData, { from: depositor }),
        'EtherPredicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Send ether to predicate', () => {
    const depositAmount = mockValues.amounts[3]
    let etherPredicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should accept from manager', async() => {
      const sendTx = await etherPredicate.send(depositAmount)
      should.exist(sendTx)
    })

    it('Should reject from non manager', async() => {
      await expectRevert(
        etherPredicate.send(depositAmount, { from: accounts[1] }),
        'EtherPredicate: INSUFFICIENT_PERMISSIONS'
      )
    })
  })

  describe('exitTokens', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let etherPredicate
    let oldAccountBalance
    let oldContractBalance
    let exitTokensTx

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await etherPredicate.send(depositAmount)
      oldAccountBalance = new BN(await web3.eth.getBalance(withdrawer))
      oldContractBalance = new BN(await web3.eth.getBalance(etherPredicate.address))
    })

    it('Predicate should have balance', () => {
      oldContractBalance.should.be.a.bignumber.greaterThan(withdrawAmount)
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      exitTokensTx = await etherPredicate.exitTokens(withdrawer, etherAddress, burnLog)
      should.exist(exitTokensTx)
    })

    it('Withdraw amount should be deducted from contract', async() => {
      const newContractBalance = new BN(await web3.eth.getBalance(etherPredicate.address))
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.sub(withdrawAmount)
      )
    })

    it('Withdraw amount should be credited to correct address', async() => {
      const newAccountBalance = new BN(await web3.eth.getBalance(withdrawer))
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(withdrawAmount)
      )
    })
  })

  describe('exitTokens called by different user', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[3]
    let exitTokensTx
    let etherPredicate
    let oldAccountBalance
    let oldContractBalance

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await etherPredicate.send(depositAmount)
      oldAccountBalance = new BN(await web3.eth.getBalance(withdrawer))
      oldContractBalance = new BN(await web3.eth.getBalance(etherPredicate.address))
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      exitTokensTx = await etherPredicate.exitTokens(exitCaller, etherAddress, burnLog)
      should.exist(exitTokensTx)
    })

    it('Withdraw amount should be deducted from contract', async() => {
      const newContractBalance = new BN(await web3.eth.getBalance(etherPredicate.address))
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.sub(withdrawAmount)
      )
    })

    it('Withdraw amount should be credited to correct address', async() => {
      const newAccountBalance = new BN(await web3.eth.getBalance(withdrawer))
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(withdrawAmount)
      )
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let etherPredicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await etherPredicate.send(depositAmount)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      await expectRevert(etherPredicate.exitTokens(withdrawer, etherAddress, burnLog), 'EtherPredicate: INVALID_SIGNATURE')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let etherPredicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await etherPredicate.send(depositAmount)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expectRevert(etherPredicate.exitTokens(withdrawer, etherAddress, burnLog), 'EtherPredicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let etherPredicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await etherPredicate.send(depositAmount)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expectRevert(
        etherPredicate.exitTokens(withdrawer, etherAddress, burnLog, { from: accounts[2] }),
        'EtherPredicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
