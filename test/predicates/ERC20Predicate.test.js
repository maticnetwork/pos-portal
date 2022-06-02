import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC20TransferLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const abi = new AbiCoder()

contract('ERC20Predicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance
    let lockTokensTx
    let lockedLog

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.transfer(depositor, depositAmount)
      oldAccountBalance = await dummyERC20.balanceOf(depositor)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
      await dummyERC20.approve(erc20Predicate.address, depositAmount, { from: depositor })
    })

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.at.most(oldAccountBalance)
    })

    it('Depositor should have approved proper amount', async() => {
      const allowance = await dummyERC20.allowance(depositor, erc20Predicate.address)
      allowance.should.be.a.bignumber.that.equals(depositAmount)
    })

    it('Should be able to receive lockTokens tx', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      lockTokensTx = await erc20Predicate.lockTokens(depositor, depositReceiver, dummyERC20.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedERC20 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC20')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          erc20Predicate.address.toLowerCase()
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

      it('Should emit correct root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC20.address)
      })
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(depositor)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('lockTokens called by non manager', () => {
    const depositAmount = mockValues.amounts[3]
    const depositor = accounts[1]
    const depositReceiver = accounts[2]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let dummyERC20
    let erc20Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount, { from: depositor })
    })

    it('Should revert with correct reason', async() => {
      await expectRevert(
        erc20Predicate.lockTokens(depositor, depositReceiver, dummyERC20.address, depositData, { from: depositor }),
        'ERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance
    let exitTokensTx
    let exitedLog

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.address, depositData)
      oldAccountBalance = await dummyERC20.balanceOf(withdrawer)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
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
      exitTokensTx = await erc20Predicate.exitTokens(withdrawer, dummyERC20.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC20 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC20')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc20Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit correct amount', () => {
        const exitedLogAmount = new BN(exitedLog.args.amount.toString())
        exitedLogAmount.should.be.bignumber.that.equals(withdrawAmount)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC20.address)
      })
    })

    it('Withdraw amount should be deducted from contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.sub(withdrawAmount)
      )
    })

    it('Withdraw amount should be credited to correct address', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(withdrawer)
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
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance
    let exitTokensTx
    let exitedLog

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.address, depositData)
      oldAccountBalance = await dummyERC20.balanceOf(withdrawer)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      exitTokensTx = await erc20Predicate.exitTokens(exitCaller, dummyERC20.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC20 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC20')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc20Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit correct amount', () => {
        const exitedLogAmount = new BN(exitedLog.args.amount.toString())
        exitedLogAmount.should.be.bignumber.that.equals(withdrawAmount)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC20.address)
      })
    })

    it('Withdraw amount should be deducted from contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.sub(withdrawAmount)
      )
    })

    it('Withdraw amount should be credited to correct address', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(withdrawer)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(withdrawAmount)
      )
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      await expectRevert(erc20Predicate.exitTokens(withdrawer, dummyERC20.address, burnLog), 'ERC20Predicate: INVALID_SIGNATURE')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expectRevert(erc20Predicate.exitTokens(withdrawer, dummyERC20.address, burnLog), 'ERC20Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expectRevert(
        erc20Predicate.exitTokens(withdrawer, dummyERC20.address, burnLog, { from: accounts[2] }),
        'ERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
