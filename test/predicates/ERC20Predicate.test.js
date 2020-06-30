import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder, RLP } from 'ethers/utils'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const abi = new AbiCoder()
const TRANSFER_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

contract('ERC20Predicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[0]
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
      oldAccountBalance = await dummyERC20.balanceOf(depositor)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.address)
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
    })

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
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

  describe('exitTokens', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance
    let exitTokensTx

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
      const burnLog = RLP.encode([
        '0x0',
        [
          TRANSFER_EVENT_SIG,
          withdrawer,
          mockValues.zeroAddress
        ],
        '0x' + withdrawAmount.toString(16)
      ])
      exitTokensTx = await erc20Predicate.exitTokens(withdrawer, dummyERC20.address, burnLog)
      should.exist(exitTokensTx)
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
})
