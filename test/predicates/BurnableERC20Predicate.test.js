import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC20TransferLog, getERC20BurnLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
    .use(chaiAsPromised)
    .use(chaiBN(BN))
    .should()

const should = chai.should()
const abi = new AbiCoder()

contract('BurnableERC20Predicate', (accounts) => {
    describe('lockTokens', () => {
        const depositAmount = mockValues.amounts[4]
        const depositReceiver = mockValues.addresses[7]
        const depositor = accounts[1]

        let dummyBurnableERC20
        let burnableERC20Predicate
        let oldAccountBalance
        let oldContractBalance
        let lockTokensTx
        let lockedLog

        before(async () => {

            const contracts = await deployer.deployFreshRootContracts(accounts)
            dummyBurnableERC20 = contracts.dummyBurnableERC20
            burnableERC20Predicate = contracts.burnableERC20Predicate

            const PREDICATE_ROLE = await dummyBurnableERC20.PREDICATE_ROLE()
            await dummyBurnableERC20.grantRole(PREDICATE_ROLE, burnableERC20Predicate.address)

            await dummyBurnableERC20.transfer(depositor, depositAmount)
            oldAccountBalance = await dummyBurnableERC20.balanceOf(depositor)
            oldContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)

            await dummyBurnableERC20.approve(burnableERC20Predicate.address, depositAmount, { from: depositor })

        })

        it('Depositor should have proper balance', () => {
            depositAmount.should.be.a.bignumber.at.most(oldAccountBalance)
        })

        it('Depositor should have approved proper amount', async () => {
            const allowance = await dummyBurnableERC20.allowance(depositor, burnableERC20Predicate.address)
            allowance.should.be.a.bignumber.that.equals(depositAmount)
        })

        it('Should be able to receive lockTokens tx', async () => {
            const depositData = abi.encode(['uint256'], [depositAmount.toString()])
            lockTokensTx = await burnableERC20Predicate.lockTokens(depositor, depositReceiver, dummyBurnableERC20.address, depositData)
            should.exist(lockTokensTx)
        })

        it('Should emit LockedBurnableERC20 log', () => {
            const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
            lockedLog = logs.find(l => l.event === 'LockedBurnableERC20')
            should.exist(lockedLog)
        })

        describe('Correct values should be emitted in LockedBurnableERC20 log', () => {
            it('Event should be emitted by correct contract', () => {
                lockedLog.address.should.equal(
                    burnableERC20Predicate.address.toLowerCase()
                )
            })

            it('Should emit proper depositor', () => {
                lockedLog.args.depositor.should.equal(depositor)
            })

            it('Should emit correct deposit receiver', () => {
                lockedLog.args.depositReceiver.should.equal(depositReceiver)
            })

            it('Should emit correct root token', () => {
                lockedLog.args.rootToken.should.equal(dummyBurnableERC20.address)
            })

            it('Should emit correct amount', () => {
                const lockedLogAmount = new BN(lockedLog.args.amount.toString())
                lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
            })
        })

        it('Deposit amount should be deducted from depositor account', async () => {
            const newAccountBalance = await dummyBurnableERC20.balanceOf(depositor)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalance.sub(depositAmount)
            )
        })

        it('Deposit amount should be credited to correct contract', async () => {
            const newContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)
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
        let dummyBurnableERC20
        let burnableERC20Predicate

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)
            dummyBurnableERC20 = contracts.dummyBurnableERC20
            burnableERC20Predicate = contracts.burnableERC20Predicate

            const PREDICATE_ROLE = await dummyBurnableERC20.PREDICATE_ROLE()
            await dummyBurnableERC20.grantRole(PREDICATE_ROLE, burnableERC20Predicate.address)

            await dummyBurnableERC20.transfer(depositor, depositAmount)
            await dummyBurnableERC20.approve(burnableERC20Predicate.address, depositAmount, { from: depositor })
        })

        it('Should revert with correct reason', async () => {
            await expectRevert(
                burnableERC20Predicate.lockTokens(depositor, depositReceiver, dummyERC20.address, depositData, { from: depositor }),
                'ERC20Predicate: INSUFFICIENT_PERMISSIONS')
        })
    })

    describe('exitTokens with `Transfer` event log', () => {
        const withdrawAmount = mockValues.amounts[2]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC20
        let burnableERC20Predicate
        let oldAccountBalance
        let oldContractBalance
        let exitTokensTx

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC20 = contracts.dummyBurnableERC20
            burnableERC20Predicate = contracts.burnableERC20Predicate

            await dummyBurnableERC20.approve(burnableERC20Predicate.address, depositAmount)
            const depositData = abi.encode(['uint256'], [depositAmount.toString()])
            await burnableERC20Predicate.lockTokens(accounts[0], withdrawer, dummyBurnableERC20.address, depositData)

            oldAccountBalance = await dummyBurnableERC20.balanceOf(withdrawer)
            oldContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)
        })

        it('Predicate should have balance', () => {
            oldContractBalance.should.be.a.bignumber.greaterThan(withdrawAmount)
        })

        it('Should be able to receive exitTokens tx', async () => {
            const burnLog = getERC20TransferLog({
                from: withdrawer,
                to: mockValues.zeroAddress,
                amount: withdrawAmount
            })
            exitTokensTx = await burnableERC20Predicate.exitTokens(withdrawer, dummyBurnableERC20.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Withdraw amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalance.sub(withdrawAmount)
            )
        })

        it('Withdraw amount should be credited to correct address', async () => {
            const newAccountBalance = await dummyBurnableERC20.balanceOf(withdrawer)
            newAccountBalance.should.be.a.bignumber.that.equals(
                oldAccountBalance.add(withdrawAmount)
            )
        })
    })

    describe('exitTokens with `Burn` event log', () => {
        const burnAmount = mockValues.amounts[2]
        const depositAmount = burnAmount.add(mockValues.amounts[3])
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC20
        let burnableERC20Predicate
        let oldContractBalance
        let exitTokensTx
        let burntLog

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC20 = contracts.dummyBurnableERC20
            burnableERC20Predicate = contracts.burnableERC20Predicate

            const PREDICATE_ROLE = await dummyBurnableERC20.PREDICATE_ROLE()
            await dummyBurnableERC20.grantRole(PREDICATE_ROLE, burnableERC20Predicate.address)

            await dummyBurnableERC20.approve(burnableERC20Predicate.address, depositAmount)
            const depositData = abi.encode(['uint256'], [depositAmount.toString()])
            await burnableERC20Predicate.lockTokens(accounts[0], withdrawer, dummyBurnableERC20.address, depositData)

            oldContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)
        })

        it('Predicate should have balance', () => {
            oldContractBalance.should.be.a.bignumber.greaterThan(burnAmount)
        })

        it('exitTokens tx must go through', async () => {
            const burnLog = getERC20BurnLog({
                from: withdrawer,
                amount: burnAmount
            })

            exitTokensTx = await burnableERC20Predicate.exitTokens(withdrawer, dummyBurnableERC20.address, burnLog)
            should.exist(exitTokensTx)
        })

        it('Burn amount should be deducted from contract', async () => {
            const newContractBalance = await dummyBurnableERC20.balanceOf(burnableERC20Predicate.address)
            newContractBalance.should.be.a.bignumber.that.equals(
                oldContractBalance.sub(burnAmount)
            )
        })

        it('Burn tx must emit Transfer event', async () => {

            const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
            burntLog = logs.find(l => l.event === 'Transfer')
            should.exist(burntLog)

        })

        describe('Correct values should be emitted in Transfer event log', () => {

            it('Event should be emitted by correct contract', () => {

                burntLog.address.should.equal(
                    dummyBurnableERC20.address.toLowerCase()
                )

            })

            it('Should emit proper from', () => {

                burntLog.args.from.should.equal(burnableERC20Predicate.address)

            })

            it('Should emit correct to', () => {

                burntLog.args.to.should.equal(mockValues.zeroAddress)

            })

            it('Should emit correct amount', () => {

                const burntLogAmount = new BN(burntLog.args.amount.toString())
                burntLogAmount.should.be.bignumber.that.equals(burnAmount)

            })

        })
    })

    describe('exitTokens with incorrect burn transaction signature', () => {
        const withdrawAmount = mockValues.amounts[2]
        const depositAmount = withdrawAmount.add(mockValues.amounts[3])
        const withdrawer = mockValues.addresses[8]

        let dummyBurnableERC20
        let burnableERC20Predicate

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC20 = contracts.dummyBurnableERC20
            burnableERC20Predicate = contracts.burnableERC20Predicate

            await dummyBurnableERC20.approve(burnableERC20Predicate.address, depositAmount)
            const depositData = abi.encode(['uint256'], [depositAmount.toString()])
            await burnableERC20Predicate.lockTokens(accounts[0], withdrawer, dummyBurnableERC20.address, depositData)
        })

        it('Should revert with correct reason', async () => {
            const burnLog = getERC20TransferLog({
                overrideSig: mockValues.bytes32[2],
                from: withdrawer,
                to: mockValues.zeroAddress,
                amount: withdrawAmount
            })
            await expectRevert(burnableERC20Predicate.exitTokens(withdrawer, dummyBurnableERC20.address, burnLog), 'BurnableERC20Predicate: INVALID_SIGNATURE')
        })
    })
})
