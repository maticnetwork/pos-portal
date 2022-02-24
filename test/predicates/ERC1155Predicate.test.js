import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC1155TransferSingleLog, getERC1155TransferBatchLog } from '../helpers/logs'
import { constructERC1155DepositData } from '../helpers/utils'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ERC1155Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenIdA = mockValues.numbers[2]
    const tokenIdB = mockValues.numbers[7]
    const amountA = mockValues.amounts[0]
    const amountB = mockValues.amounts[1]
    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let dummyERC1155
    let erc1155Predicate
    let lockTokensTx
    let lockedLog
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenIdA, amountA)
      await dummyERC1155.mint(depositor, tokenIdB, amountB)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      oldAccountBalanceA = await dummyERC1155.balanceOf(depositor, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(depositor, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
    })

    it('Depositor should have balance', () => {
      amountA.should.be.a.bignumber.at.most(oldAccountBalanceA)
      amountB.should.be.a.bignumber.at.most(oldAccountBalanceB)
    })

    it('Depositor should have approved token transfer', async() => {
      const approved = await dummyERC1155.isApprovedForAll(depositor, erc1155Predicate.address)
      approved.should.equal(true)
    })

    it('Should be able to receive lockTokens tx', async() => {
      lockTokensTx = await erc1155Predicate.lockTokens(depositor, depositReceiver, dummyERC1155.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedBatchERC1155 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedBatchERC1155')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedBatchERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit proper deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })

      it('Should emit proper root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id for A', () => {
        const id = lockedLog.args.ids[0].toNumber()
        id.should.equal(tokenIdA)
      })

      it('Should emit proper token id for B', () => {
        const id = lockedLog.args.ids[1].toNumber()
        id.should.equal(tokenIdB)
      })

      it('Should emit proper amount for A', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(amountA)
      })

      it('Should emit proper amount for B', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[1].toString())
        amount.should.be.a.bignumber.that.equals(amountB)
      })
    })

    it('Deposit amount should be deducted from depositor account for A', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositor, tokenIdA)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceA.sub(amountA)
      )
    })

    it('Deposit amount should be deducted from depositor account for B', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositor, tokenIdB)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceB.sub(amountB)
      )
    })

    it('Deposit amount should be credited to correct contract for A', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceA.add(amountA)
      )
    })

    it('Deposit amount should be credited to correct contract for B', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceB.add(amountB)
      )
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const amount = mockValues.amounts[9]
    const depositData = constructERC1155DepositData([tokenId], [amount])
    const depositor = accounts[1]
    const depositReceiver = accounts[2]
    let dummyERC1155
    let erc1155Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenId, amount)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
    })

    it('Should revert with correct reason', async() => {
      await expectRevert(
        erc1155Predicate.lockTokens(depositor, depositReceiver, dummyERC1155.address, depositData, { from: depositor }),
        'ERC1155Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens single', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate
    let exitTokensTx
    let exitedLog
    let oldAccountBalance
    let oldContractBalance

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenId, depositAmount)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
      oldAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenId)
      oldContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenId)
    })

    it('Predicate should have the token', async() => {
      withdrawAmount.should.be.a.bignumber.at.most(oldContractBalance)
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId,
        amount: withdrawAmount
      })
      exitTokensTx = await erc1155Predicate.exitTokens(withdrawer, dummyERC1155.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC1155 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC1155')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit proper root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id', () => {
        const id = exitedLog.args.id.toNumber()
        id.should.equal(tokenId)
      })

      it('Should emit proper amount', () => {
        const exitedLogAmount = new BN(exitedLog.args.amount.toString())
        exitedLogAmount.should.be.a.bignumber.that.equals(withdrawAmount)
      })
    })

    it('Withdaw amount should be deducted from contract', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.sub(withdrawAmount)
      )
    })

    it('Withdraw amount should be credited to withdrawer', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(withdrawAmount)
      )
    })
  })

  describe('exitTokens batch', () => {
    const withdrawAmountA = mockValues.amounts[9]
    const withdrawAmountB = mockValues.amounts[8]
    const depositAmountA = withdrawAmountA.add(mockValues.amounts[3])
    const depositAmountB = withdrawAmountB.add(mockValues.amounts[4])
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate
    let exitTokensTx
    let exitedLog
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenIdA, depositAmountA)
      await dummyERC1155.mint(depositor, tokenIdB, depositAmountB)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
      oldAccountBalanceA = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
    })

    it('Predicate should have the token balances', async() => {
      withdrawAmountA.should.be.a.bignumber.at.most(oldContractBalanceA)
      withdrawAmountB.should.be.a.bignumber.at.most(oldContractBalanceB)
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [withdrawAmountA, withdrawAmountB]
      })
      exitTokensTx = await erc1155Predicate.exitTokens(withdrawer, dummyERC1155.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedBatchERC1155 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedBatchERC1155')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedBatchERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit proper root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id for A', () => {
        const id = exitedLog.args.ids[0].toNumber()
        id.should.equal(tokenIdA)
      })

      it('Should emit proper token id for B', () => {
        const id = exitedLog.args.ids[1].toNumber()
        id.should.equal(tokenIdB)
      })

      it('Should emit proper amount for A', () => {
        const amounts = exitedLog.args.amounts
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(withdrawAmountA)
      })

      it('Should emit proper amount for B', () => {
        const amounts = exitedLog.args.amounts
        const amount = new BN(amounts[1].toString())
        amount.should.be.a.bignumber.that.equals(withdrawAmountB)
      })
    })

    it('Withdaw amount should be deducted from contract for A', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceA.sub(withdrawAmountA)
      )
    })

    it('Withdaw amount should be deducted from contract for B', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceB.sub(withdrawAmountB)
      )
    })

    it('Withdraw amount should be credited to withdrawer for A', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceA.add(withdrawAmountA)
      )
    })

    it('Withdraw amount should be credited to withdrawer for B', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceB.add(withdrawAmountB)
      )
    })
  })

  describe('exitTokens called by different user', () => {
    const withdrawAmountA = mockValues.amounts[9]
    const withdrawAmountB = mockValues.amounts[8]
    const depositAmountA = withdrawAmountA.add(mockValues.amounts[3])
    const depositAmountB = withdrawAmountB.add(mockValues.amounts[4])
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[5]
    let dummyERC1155
    let erc1155Predicate
    let exitTokensTx
    let exitedLog
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenIdA, depositAmountA)
      await dummyERC1155.mint(depositor, tokenIdB, depositAmountB)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
      oldAccountBalanceA = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
    })

    it('Should be able to receive exitTokens tx', async() => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [withdrawAmountA, withdrawAmountB]
      })
      exitTokensTx = await erc1155Predicate.exitTokens(exitCaller, dummyERC1155.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedBatchERC1155 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedBatchERC1155')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedBatchERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit proper root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id for A', () => {
        const id = exitedLog.args.ids[0].toNumber()
        id.should.equal(tokenIdA)
      })

      it('Should emit proper token id for B', () => {
        const id = exitedLog.args.ids[1].toNumber()
        id.should.equal(tokenIdB)
      })

      it('Should emit proper amount for A', () => {
        const amounts = exitedLog.args.amounts
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(withdrawAmountA)
      })

      it('Should emit proper amount for B', () => {
        const amounts = exitedLog.args.amounts
        const amount = new BN(amounts[1].toString())
        amount.should.be.a.bignumber.that.equals(withdrawAmountB)
      })
    })

    it('Withdaw amount should be deducted from contract for A', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdA)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceA.sub(withdrawAmountA)
      )
    })

    it('Withdaw amount should be deducted from contract for B', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, tokenIdB)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceB.sub(withdrawAmountB)
      )
    })

    it('Withdraw amount should be credited to withdrawer for A', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceA.add(withdrawAmountA)
      )
    })

    it('Withdraw amount should be credited to withdrawer for B', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceB.add(withdrawAmountB)
      )
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenId, depositAmount)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC1155TransferSingleLog({
        overrideSig: mockValues.bytes32[2],
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expectRevert(erc1155Predicate.exitTokens(withdrawer, dummyERC1155.address, burnLog), 'ERC1155Predicate: INVALID_WITHDRAW_SIG')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenId, depositAmount)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expectRevert(erc1155Predicate.exitTokens(withdrawer, dummyERC1155.address, burnLog), 'ERC1155Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    const depositor = accounts[1]
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate

    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor, tokenId, depositAmount)
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true, { from: depositor })
      await erc1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyERC1155.address, depositData)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expectRevert(
        erc1155Predicate.exitTokens(withdrawer, dummyERC1155.address, burnLog, { from: accounts[2] }),
        'ERC1155Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
