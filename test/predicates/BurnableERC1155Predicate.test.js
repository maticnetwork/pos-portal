import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import {
    getERC1155TransferSingleLog,
    getERC1155TransferBatchLog,
    getERC1155TransferSingleWithMetadataLog,
    getERC1155TransferBatchWithMetadataLog,
    getERC1155BurnSingleLog,
    getERC1155BurnBatchLog,
    getERC1155BurnSingleWithMetadataLog,
    getERC1155BurnBatchWithMetadataLog
} from '../helpers/logs'
import { constructERC1155DepositData } from '../helpers/utils'

// Enable and inject BN dependency
chai
    .use(chaiAsPromised)
    .use(chaiBN(BN))
    .should()

const should = chai.should()

contract('BurnableERC1155Predicate', (accounts) => {

    describe('lockTokens [ only batch deposit allowed ]', () => {
        const tokenIdA = mockValues.numbers[2]
        const tokenIdB = mockValues.numbers[7]
        const amountA = mockValues.amounts[0]
        const amountB = mockValues.amounts[1]
        const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])
        const depositReceiver = mockValues.addresses[7]
        const depositor = accounts[1]

        let dummyBurnableERC1155
        let burnableERC1155Predicate

        let lockTokensTx
        let lockedLog

        let oldAccountBalanceA
        let oldAccountBalanceB
        let oldContractBalanceA
        let oldContractBalanceB

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenIdA, amountA)
            await dummyBurnableERC1155.mint(depositor, tokenIdB, amountB)

            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })

            oldAccountBalanceA = await dummyBurnableERC1155.balanceOf(depositor, tokenIdA)
            oldAccountBalanceB = await dummyBurnableERC1155.balanceOf(depositor, tokenIdB)
            oldContractBalanceA = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
        })

        it('Depositor should have balance', () => {
            amountA.should.be.a.bignumber.at.most(oldAccountBalanceA)
            amountB.should.be.a.bignumber.at.most(oldAccountBalanceB)
        })

        it('Depositor should have approved token transfer', async () => {
            const approved = await dummyBurnableERC1155.isApprovedForAll(depositor, burnableERC1155Predicate.address)
            approved.should.equal(true)
        })

        it('Should be able to receive lockTokens tx', async () => {
            lockTokensTx = await burnableERC1155Predicate.lockTokens(depositor, depositReceiver, dummyBurnableERC1155.address, depositData)
            should.exist(lockTokensTx)
        })

        it('Should emit LockedBatchBurnableERC1155 log', () => {
            const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
            lockedLog = logs.find(l => l.event === 'LockedBatchBurnableERC1155')
            should.exist(lockedLog)
        })

        describe('Correct values should be emitted in LockedBatchBurnableERC1155 log', () => {
            it('Event should be emitted by correct contract', () => {
                lockedLog.address.should.equal(
                    burnableERC1155Predicate.address.toLowerCase()
                )
            })

            it('Should emit proper depositor', () => {
                lockedLog.args.depositor.should.equal(depositor)
            })

            it('Should emit proper deposit receiver', () => {
                lockedLog.args.depositReceiver.should.equal(depositReceiver)
            })

            it('Should emit proper root token', () => {
                lockedLog.args.rootToken.should.equal(dummyBurnableERC1155.address)
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
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(depositor, tokenIdA)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceA.sub(amountA)
            )
        })

        it('Deposit amount should be deducted from depositor account for B', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(depositor, tokenIdB)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceB.sub(amountB)
            )
        })

        it('Deposit amount should be credited to correct contract for A', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceA.add(amountA)
            )
        })

        it('Deposit amount should be credited to correct contract for B', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
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

        let dummyBurnableERC1155
        let burnableERC1155Predicate

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenId, amount)
            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })
        })

        it('Should revert with correct reason', async () => {
            await expectRevert(
                burnableERC1155Predicate.lockTokens(depositor, depositReceiver, dummyBurnableERC1155.address, depositData, { from: depositor }),
                'BurnableERC1155Predicate: INSUFFICIENT_PERMISSIONS')
        })
    })

    describe('exitTokens single', () => {
        const withdrawAmount = mockValues.amounts[9]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const tokenId = mockValues.numbers[4]
        const depositData = constructERC1155DepositData([tokenId], [depositAmount])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalance
        let oldContractBalance

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenId, depositAmount)
            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })
            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            oldContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
        })

        it('Predicate should have the token', async () => {
            withdrawAmount.should.be.a.bignumber.at.most(oldContractBalance)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155TransferSingleLog({
                operator: withdrawer,
                from: withdrawer,
                to: mockValues.zeroAddress,
                tokenId: tokenId,
                amount: withdrawAmount
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalance.sub(withdrawAmount)
            )
        })

        it('Withdraw amount should be credited to withdrawer', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
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

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalanceA
        let oldAccountBalanceB
        let oldContractBalanceA
        let oldContractBalanceB

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenIdA, depositAmountA)
            await dummyBurnableERC1155.mint(depositor, tokenIdB, depositAmountB)

            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })

            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalanceA = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            oldAccountBalanceB = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            oldContractBalanceA = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
        })

        it('Predicate should have the token balances', async () => {
            withdrawAmountA.should.be.a.bignumber.at.most(oldContractBalanceA)
            withdrawAmountB.should.be.a.bignumber.at.most(oldContractBalanceB)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155TransferBatchLog({
                operator: withdrawer,
                from: withdrawer,
                to: mockValues.zeroAddress,
                tokenIds: [tokenIdA, tokenIdB],
                amounts: [withdrawAmountA, withdrawAmountB]
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract for A', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceA.sub(withdrawAmountA)
            )
        })

        it('Withdraw amount should be deducted from contract for B', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceB.sub(withdrawAmountB)
            )
        })

        it('Withdraw amount should be credited to withdrawer for A', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceA.add(withdrawAmountA)
            )
        })

        it('Withdraw amount should be credited to withdrawer for B', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceB.add(withdrawAmountB)
            )
        })
    })

    describe('exitTokens single, with metadata', () => {
        const withdrawAmount = mockValues.amounts[9]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const tokenId = mockValues.numbers[4]
        const depositData = constructERC1155DepositData([tokenId], [depositAmount])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]
        const metaData = 'https://erc1155.matic.network'

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalance
        let oldContractBalance

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenId, depositAmount)
            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })
            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            oldContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
        })

        it('Predicate should have the token', async () => {
            withdrawAmount.should.be.a.bignumber.at.most(oldContractBalance)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155TransferSingleWithMetadataLog({
                operator: withdrawer,
                from: withdrawer,
                to: mockValues.zeroAddress,
                tokenId,
                amount: withdrawAmount,
                metaData
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalance.sub(withdrawAmount)
            )
        })

        it('Withdraw amount should be credited to withdrawer', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalance.add(withdrawAmount)
            )
        })
    })

    describe('exitTokens batch, with metadata', () => {
        const withdrawAmountA = mockValues.amounts[9]
        const withdrawAmountB = mockValues.amounts[8]
        const depositAmountA = withdrawAmountA.add(mockValues.amounts[3])
        const depositAmountB = withdrawAmountB.add(mockValues.amounts[4])
        const tokenIdA = mockValues.numbers[4]
        const tokenIdB = mockValues.numbers[5]
        const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]
        const metaData = 'https://erc1155.matic.network'

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalanceA
        let oldAccountBalanceB
        let oldContractBalanceA
        let oldContractBalanceB

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            await dummyBurnableERC1155.mint(depositor, tokenIdA, depositAmountA)
            await dummyBurnableERC1155.mint(depositor, tokenIdB, depositAmountB)

            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })

            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalanceA = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            oldAccountBalanceB = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            oldContractBalanceA = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
        })

        it('Predicate should have the token balances', async () => {
            withdrawAmountA.should.be.a.bignumber.at.most(oldContractBalanceA)
            withdrawAmountB.should.be.a.bignumber.at.most(oldContractBalanceB)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155TransferBatchWithMetadataLog({
                operator: withdrawer,
                from: withdrawer,
                to: mockValues.zeroAddress,
                tokenIds: [tokenIdA, tokenIdB],
                amounts: [withdrawAmountA, withdrawAmountB],
                metaData
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract for A', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceA.sub(withdrawAmountA)
            )
        })

        it('Withdraw amount should be deducted from contract for B', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceB.sub(withdrawAmountB)
            )
        })

        it('Withdraw amount should be credited to withdrawer for A', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceA.add(withdrawAmountA)
            )
        })

        it('Withdraw amount should be credited to withdrawer for B', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalanceB.add(withdrawAmountB)
            )
        })
    })

    describe('burnTokens single', () => {
        const withdrawAmount = mockValues.amounts[9]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const tokenId = mockValues.numbers[4]
        const depositData = constructERC1155DepositData([tokenId], [depositAmount])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalance
        let oldContractBalance

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            const PREDICATE_ROLE = await dummyBurnableERC1155.PREDICATE_ROLE()
            await dummyBurnableERC1155.grantRole(PREDICATE_ROLE, burnableERC1155Predicate.address)

            await dummyBurnableERC1155.mint(depositor, tokenId, depositAmount)
            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })
            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            oldContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
        })

        it('Predicate should have the token', async () => {
            withdrawAmount.should.be.a.bignumber.at.most(oldContractBalance)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155BurnSingleLog({
                operator: withdrawer,
                from: withdrawer,
                tokenId: tokenId,
                amount: withdrawAmount
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
            newContractBalance.should.be.a.bignumber.that.equals(oldContractBalance.sub(withdrawAmount))
        })

        it('Withdraw amount should not be credited back to withdrawer', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalance)
        })
    })

    describe('burnTokens batch', () => {
        const withdrawAmountA = mockValues.amounts[9]
        const withdrawAmountB = mockValues.amounts[8]
        const depositAmountA = withdrawAmountA.add(mockValues.amounts[3])
        const depositAmountB = withdrawAmountB.add(mockValues.amounts[4])
        const tokenIdA = mockValues.numbers[4]
        const tokenIdB = mockValues.numbers[5]
        const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalanceA
        let oldAccountBalanceB
        let oldContractBalanceA
        let oldContractBalanceB

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            const PREDICATE_ROLE = await dummyBurnableERC1155.PREDICATE_ROLE()
            await dummyBurnableERC1155.grantRole(PREDICATE_ROLE, burnableERC1155Predicate.address)

            await dummyBurnableERC1155.mint(depositor, tokenIdA, depositAmountA)
            await dummyBurnableERC1155.mint(depositor, tokenIdB, depositAmountB)

            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })

            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalanceA = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            oldAccountBalanceB = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            oldContractBalanceA = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
        })

        it('Predicate should have the token balances', async () => {
            withdrawAmountA.should.be.a.bignumber.at.most(oldContractBalanceA)
            withdrawAmountB.should.be.a.bignumber.at.most(oldContractBalanceB)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155BurnBatchLog({
                operator: withdrawer,
                from: withdrawer,
                tokenIds: [tokenIdA, tokenIdB],
                amounts: [withdrawAmountA, withdrawAmountB]
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract for A', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceA.sub(withdrawAmountA)
            )
        })

        it('Withdraw amount should be deducted from contract for B', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceB.sub(withdrawAmountB)
            )
        })

        it('Withdraw amount should not be credited back to withdrawer for A', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalanceA)
        })

        it('Withdraw amount should not be credited back to withdrawer for B', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalanceB)
        })
    })

    describe('burnTokens single, with arbitrary metadata', () => {
        const withdrawAmount = mockValues.amounts[9]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const tokenId = mockValues.numbers[4]
        const depositData = constructERC1155DepositData([tokenId], [depositAmount])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]
        const metaData = 'https://erc1155.matic.network'

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalance
        let oldContractBalance

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            const PREDICATE_ROLE = await dummyBurnableERC1155.PREDICATE_ROLE()
            await dummyBurnableERC1155.grantRole(PREDICATE_ROLE, burnableERC1155Predicate.address)

            await dummyBurnableERC1155.mint(depositor, tokenId, depositAmount)
            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })
            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            oldContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
        })

        it('Predicate should have the token', async () => {
            withdrawAmount.should.be.a.bignumber.at.most(oldContractBalance)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155BurnSingleWithMetadataLog({
                operator: withdrawer,
                from: withdrawer,
                tokenId,
                amount: withdrawAmount,
                metaData
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenId)
            newContractBalance.should.be.a.bignumber.that.equals(oldContractBalance.sub(withdrawAmount))
        })

        it('Withdraw amount should not be credited back to withdrawer', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenId)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalance)
        })
    })

    describe('burnTokens batch, with arbitrary metadata', () => {
        const withdrawAmountA = mockValues.amounts[9]
        const withdrawAmountB = mockValues.amounts[8]
        const depositAmountA = withdrawAmountA.add(mockValues.amounts[3])
        const depositAmountB = withdrawAmountB.add(mockValues.amounts[4])
        const tokenIdA = mockValues.numbers[4]
        const tokenIdB = mockValues.numbers[5]
        const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
        const depositor = accounts[1]
        const withdrawer = mockValues.addresses[8]
        const metaData = 'https://erc1155.matic.network'

        let dummyBurnableERC1155
        let burnableERC1155Predicate
        let exitTokensTx
        let oldAccountBalanceA
        let oldAccountBalanceB
        let oldContractBalanceA
        let oldContractBalanceB

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC1155 = contracts.dummyBurnableERC1155
            burnableERC1155Predicate = contracts.burnableERC1155Predicate

            const PREDICATE_ROLE = await dummyBurnableERC1155.PREDICATE_ROLE()
            await dummyBurnableERC1155.grantRole(PREDICATE_ROLE, burnableERC1155Predicate.address)

            await dummyBurnableERC1155.mint(depositor, tokenIdA, depositAmountA)
            await dummyBurnableERC1155.mint(depositor, tokenIdB, depositAmountB)

            await dummyBurnableERC1155.setApprovalForAll(burnableERC1155Predicate.address, true, { from: depositor })

            await burnableERC1155Predicate.lockTokens(depositor, mockValues.addresses[2], dummyBurnableERC1155.address, depositData)

            oldAccountBalanceA = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            oldAccountBalanceB = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            oldContractBalanceA = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            oldContractBalanceB = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
        })

        it('Predicate should have the token balances', async () => {
            withdrawAmountA.should.be.a.bignumber.at.most(oldContractBalanceA)
            withdrawAmountB.should.be.a.bignumber.at.most(oldContractBalanceB)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC1155BurnBatchWithMetadataLog({
                operator: withdrawer,
                from: withdrawer,
                tokenIds: [tokenIdA, tokenIdB],
                amounts: [withdrawAmountA, withdrawAmountB],
                metaData
            })
            exitTokensTx = await burnableERC1155Predicate.exitTokens(withdrawer, dummyBurnableERC1155.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract for A', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdA)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceA.sub(withdrawAmountA)
            )
        })

        it('Withdraw amount should be deducted from contract for B', async () => {
            const newContractBalance = await dummyBurnableERC1155.balanceOf(burnableERC1155Predicate.address, tokenIdB)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalanceB.sub(withdrawAmountB)
            )
        })

        it('Withdraw amount should not be credited back to withdrawer for A', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdA)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalanceA)
        })

        it('Withdraw amount should not be credited back to withdrawer for B', async () => {
            const newAccountBalance = await dummyBurnableERC1155.balanceOf(withdrawer, tokenIdB)
            newAccountBalance.should.be.a.bignumber.that.equals(oldAccountBalanceB)
        })
    })

})
