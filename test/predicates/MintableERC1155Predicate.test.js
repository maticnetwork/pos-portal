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

contract('MintableERC1155Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenIdA = mockValues.numbers[2]
    const tokenIdB = mockValues.numbers[7]
    const amountA = mockValues.amounts[0]
    const amountB = mockValues.amounts[1]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])

    let dummyMintableERC1155
    let mintableERC1155Predicate
    let lockTokensTx
    let lockedLog
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      mintableERC1155Predicate = contracts.mintableERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor,
        from: depositor,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [amountA, amountB]
      })

            // because it's a mintable token, burning it first then
            // brining it to root chain by making predicate contract mint it for us
            await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
            await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

            oldAccountBalanceA = await dummyMintableERC1155.balanceOf(depositor, tokenIdA)
            oldAccountBalanceB = await dummyMintableERC1155.balanceOf(depositor, tokenIdB)
            oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
          })

    it('Depositor should have balance', () => {
      amountA.should.be.a.bignumber.at.most(oldAccountBalanceA)
      amountB.should.be.a.bignumber.at.most(oldAccountBalanceB)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyMintableERC1155.isApprovedForAll(depositor, mintableERC1155Predicate.address)
      approved.should.equal(true)
    })

    it('Should be able to receive lockTokens tx', async () => {
      lockTokensTx = await mintableERC1155Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC1155.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedBatchMintableERC1155 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedBatchMintableERC1155')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedBatchMintableERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          mintableERC1155Predicate.address.toLowerCase()
          )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit proper deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })

      it('Should emit proper root token', () => {
        lockedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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

    it('Deposit amount should be deducted from depositor account for A', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor, tokenIdA)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceA.sub(amountA)
        )
    })

    it('Deposit amount should be deducted from depositor account for B', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor, tokenIdB)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceB.sub(amountB)
        )
    })

    it('Deposit amount should be credited to correct contract for A', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceA.add(amountA)
        )
    })

    it('Deposit amount should be credited to correct contract for B', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
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
  let dummyMintableERC1155
  let mintableERC1155Predicate

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferBatchLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenIds: [tokenId],
      amounts: [amount]
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })
  })

  it('Should revert with correct reason', async () => {
    await expectRevert(
      mintableERC1155Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC1155.address, depositData, { from: depositor }),
      'MintableERC1155Predicate: INSUFFICIENT_PERMISSIONS')
  })
})

describe('exitTokens single', () => {
  const amount = mockValues.amounts[9]
  const exitAmount = amount.div(new BN(2))
  const tokenId = mockValues.numbers[4]
  const depositData = constructERC1155DepositData([tokenId], [amount])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]
  let dummyMintableERC1155
  let mintableERC1155Predicate
  let exitTokensTx
  let exitedLog
  let oldAccountBalance
  let oldContractBalance

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    // Force predicate to `mint`
    const burnLog = getERC1155TransferSingleLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenId,
      amount
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)
    oldAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId)
    oldContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenId)
  })

  it('Predicate should have the token', async () => {
    amount.should.be.a.bignumber.at.most(oldContractBalance)
  })

  it('Should be able to receive exitTokens tx', async () => {
    const burnLog = getERC1155TransferSingleLog({
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.zeroAddress,
      tokenId: tokenId,
      amount: exitAmount
    })
    exitTokensTx = await mintableERC1155Predicate.exitTokens(withdrawer, dummyMintableERC1155.address, burnLog)
    should.exist(exitTokensTx)
  })

  it('Should emit ExitedMintableERC1155 log', () => {
    const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    exitedLog = logs.find(l => l.event === 'ExitedMintableERC1155')
    should.exist(exitedLog)
  })

  describe('Correct values should be emitted in ExitedMintableERC1155 log', () => {
    it('Event should be emitted by correct contract', () => {
      exitedLog.address.should.equal(
        mintableERC1155Predicate.address.toLowerCase()
        )
    })

    it('Should emit proper withdrawer', () => {
      exitedLog.args.exitor.should.equal(withdrawer)
    })

    it('Should emit proper root token', () => {
      exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
    })

    it('Should emit proper token id', () => {
      const exitedLogTokenId = exitedLog.args.id.toNumber()
      exitedLogTokenId.should.equal(tokenId)
    })

    it('Should emit proper token amount', () => {
      const exitedLogAmount = new BN(exitedLog.args.amount.toString())
      exitedLogAmount.should.be.a.bignumber.that.equals(exitAmount)
    })
  })

  it('Withdaw amount should be deducted from contract', async () => {
    const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenId)
    newContractBalance.should.be.a.bignumber.that.equals(
      oldContractBalance.sub(exitAmount)
      )
  })

  it('Withdraw amount should be credited to withdrawer', async () => {
    const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId)
    newAccountBalance.should.be.a.bignumber.that.equals(
      oldAccountBalance.add(exitAmount)
      )
  })
})

describe('exitTokens batch', () => {
  const amountA = mockValues.amounts[9]
  const amountB = mockValues.amounts[8]
  const burnAmountA = amountA.div(new BN(2))
  const burnAmountB = amountB.div(new BN(2))

  const tokenIdA = mockValues.numbers[4]
  const tokenIdB = mockValues.numbers[5]

  const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]

  let dummyMintableERC1155
  let mintableERC1155Predicate
  let exitTokensTx
  let exitedLog
  let oldAccountBalanceA
  let oldAccountBalanceB
  let oldContractBalanceA
  let oldContractBalanceB

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferBatchLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenIds: [tokenIdA, tokenIdB],
      amounts: [amountA, amountB]
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)

    oldAccountBalanceA = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA)
    oldAccountBalanceB = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB)

    oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
    oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
  })

  it('Predicate should have the token balances', async () => {
    amountA.should.be.a.bignumber.at.most(oldContractBalanceA)
    amountB.should.be.a.bignumber.at.most(oldContractBalanceB)
  })

  it('Should be able to receive exitTokens tx', async () => {
    const burnLog = getERC1155TransferBatchLog({
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.zeroAddress,
      tokenIds: [tokenIdA, tokenIdB],
      amounts: [burnAmountA, burnAmountB]
    })
    exitTokensTx = await mintableERC1155Predicate.exitTokens(withdrawer, dummyMintableERC1155.address, burnLog)
    should.exist(exitTokensTx)
  })

  it('Should emit ExitedBatchMintableERC1155 log', () => {
    const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    exitedLog = logs.find(l => l.event === 'ExitedBatchMintableERC1155')
    should.exist(exitedLog)
  })

  describe('Correct values should be emitted in ExitedBatchMintableERC1155 log', () => {
    it('Event should be emitted by correct contract', () => {
      exitedLog.address.should.equal(
        mintableERC1155Predicate.address.toLowerCase()
        )
    })

    it('Should emit proper withdrawer', () => {
      exitedLog.args.exitor.should.equal(withdrawer)
    })

    it('Should emit proper root token', () => {
      exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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
      amount.should.be.a.bignumber.that.equals(burnAmountA)
    })

    it('Should emit proper amount for B', () => {
      const amounts = exitedLog.args.amounts
      const amount = new BN(amounts[1].toString())
      amount.should.be.a.bignumber.that.equals(burnAmountB)
    })
  })

  it('Withdaw amount should be deducted from contract for A', async () => {
    const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
    newContractBalance.should.be.a.bignumber.that.equals(
      oldContractBalanceA.sub(burnAmountA)
      )
  })

  it('Withdaw amount should be deducted from contract for B', async () => {
    const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
    newContractBalance.should.be.a.bignumber.that.equals(
      oldContractBalanceB.sub(burnAmountB)
      )
  })

  it('Withdraw amount should be credited to withdrawer for A', async () => {
    const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA)
    newAccountBalance.should.be.a.bignumber.that.equals(
      oldAccountBalanceA.add(burnAmountA)
      )
  })

  it('Withdraw amount should be credited to withdrawer for B', async () => {
    const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB)
    newAccountBalance.should.be.a.bignumber.that.equals(
      oldAccountBalanceB.add(burnAmountB)
      )
  })
})

describe('exitTokens called by different user', () => {
  const amountA = mockValues.amounts[9]
  const amountB = mockValues.amounts[8]

  const tokenIdA = mockValues.numbers[4]
  const tokenIdB = mockValues.numbers[5]

  const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]
  const exitCaller = mockValues.addresses[5]

  let dummyMintableERC1155
  let mintableERC1155Predicate
  let exitTokensTx
  let exitedLog
  let oldAccountBalanceA
  let oldAccountBalanceB
  let oldContractBalanceA
  let oldContractBalanceB

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferBatchLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenIds: [tokenIdA, tokenIdB],
      amounts: [amountA, amountB]
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)

    oldAccountBalanceA = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA)
    oldAccountBalanceB = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB)

    oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
    oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
  })

  it('Should be able to receive exitTokens tx', async () => {
    const burnLog = getERC1155TransferBatchLog({
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.zeroAddress,
      tokenIds: [tokenIdA, tokenIdB],
      amounts: [amountA, amountB]
    })
    exitTokensTx = await mintableERC1155Predicate.exitTokens(exitCaller, dummyMintableERC1155.address, burnLog)
    should.exist(exitTokensTx)
  })

  it('Should emit ExitedBatchMintableERC1155 log', () => {
    const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    exitedLog = logs.find(l => l.event === 'ExitedBatchMintableERC1155')
    should.exist(exitedLog)
  })

  describe('Correct values should be emitted in ExitedBatchMintableERC1155 log', () => {
    it('Event should be emitted by correct contract', () => {
      exitedLog.address.should.equal(
        mintableERC1155Predicate.address.toLowerCase()
        )
    })

    it('Should emit proper withdrawer', () => {
      exitedLog.args.exitor.should.equal(withdrawer)
    })

    it('Should emit proper root token', () => {
      exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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
      amount.should.be.a.bignumber.that.equals(amountA)
    })

    it('Should emit proper amount for B', () => {
      const amounts = exitedLog.args.amounts
      const amount = new BN(amounts[1].toString())
      amount.should.be.a.bignumber.that.equals(amountB)
    })
  })

  it('Withdaw amount should be deducted from contract for A', async () => {
    const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdA)
    newContractBalance.should.be.a.bignumber.that.equals(
      oldContractBalanceA.sub(amountA)
      )
  })

  it('Withdaw amount should be deducted from contract for B', async () => {
    const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.address, tokenIdB)
    newContractBalance.should.be.a.bignumber.that.equals(
      oldContractBalanceB.sub(amountB)
      )
  })

  it('Withdraw amount should be credited to withdrawer for A', async () => {
    const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA)
    newAccountBalance.should.be.a.bignumber.that.equals(
      oldAccountBalanceA.add(amountA)
      )
  })

  it('Withdraw amount should be credited to withdrawer for B', async () => {
    const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB)
    newAccountBalance.should.be.a.bignumber.that.equals(
      oldAccountBalanceB.add(amountB)
      )
  })
})

describe('exitTokens with incorrect burn transaction signature', () => {
  const amount = mockValues.amounts[9]
  const tokenId = mockValues.numbers[4]
  const depositData = constructERC1155DepositData([tokenId], [amount])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]

  let dummyMintableERC1155
  let mintableERC1155Predicate

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferSingleLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenId,
      amount
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)
  })

  it('Should revert with correct reason', async () => {
    const burnLog = getERC1155TransferSingleLog({
      overrideSig: mockValues.bytes32[2],
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.zeroAddress,
      tokenId,
      amount
    })
    await expectRevert(mintableERC1155Predicate.exitTokens(withdrawer, dummyMintableERC1155.address, burnLog), 'MintableERC1155Predicate: INVALID_WITHDRAW_SIG')
  })
})

describe('exitTokens called using normal transfer log instead of burn', () => {
  const amount = mockValues.amounts[9]
  const tokenId = mockValues.numbers[4]
  const depositData = constructERC1155DepositData([tokenId], [amount])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]

  let dummyMintableERC1155
  let mintableERC1155Predicate

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferBatchLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenIds: [tokenId],
      amounts: [amount]
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)
  })

  it('Should revert with correct reason', async () => {
    const burnLog = getERC1155TransferSingleLog({
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.addresses[8],
      tokenId: tokenId,
      amount: amount
    })
    await expectRevert(mintableERC1155Predicate.exitTokens(withdrawer, dummyMintableERC1155.address, burnLog), 'MintableERC1155Predicate: INVALID_RECEIVER')
  })
})

describe('exitTokens called by non manager', () => {
  const amount = mockValues.amounts[9]
  const tokenId = mockValues.numbers[4]
  const depositData = constructERC1155DepositData([tokenId], [amount])
  const depositor = accounts[1]
  const withdrawer = mockValues.addresses[8]

  let dummyMintableERC1155
  let mintableERC1155Predicate

  before(async () => {
    const contracts = await deployer.deployFreshRootContracts(accounts)
    dummyMintableERC1155 = contracts.dummyMintableERC1155
    mintableERC1155Predicate = contracts.mintableERC1155Predicate

    const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
    await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.address)

    const burnLog = getERC1155TransferSingleLog({
      operator: depositor,
      from: depositor,
      to: mockValues.zeroAddress,
      tokenId,
      amount
    })

    await mintableERC1155Predicate.exitTokens(depositor, dummyMintableERC1155.address, burnLog)
    await dummyMintableERC1155.setApprovalForAll(mintableERC1155Predicate.address, true, { from: depositor })

    await mintableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyMintableERC1155.address, depositData)
  })

  it('Should revert with correct reason', async () => {
    const burnLog = getERC1155TransferSingleLog({
      operator: withdrawer,
      from: withdrawer,
      to: mockValues.zeroAddress,
      tokenId,
      amount
    })
    await expectRevert(
      mintableERC1155Predicate.exitTokens(withdrawer, dummyMintableERC1155.address, burnLog, { from: accounts[2] }),
      'MintableERC1155Predicate: INSUFFICIENT_PERMISSIONS')
  })
})
})
