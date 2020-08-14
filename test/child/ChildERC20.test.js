import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { expectRevert } from '@openzeppelin/test-helpers'

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ChildERC20', (accounts) => {
  describe('Should mint tokens on deposit', () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let oldAccountBalance
    let depositTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      oldAccountBalance = await contracts.dummyERC20.balanceOf(depositReceiver)
      const DEPOSITOR_ROLE = await contracts.dummyERC20.DEPOSITOR_ROLE()
      await contracts.dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Can receive deposit tx', async() => {
      depositTx = await contracts.dummyERC20.deposit(depositReceiver, depositData)
      should.exist(depositTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.dummyERC20.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(mockValues.zeroAddress)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(depositReceiver)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferLog.args.value.toString())
        transferLogAmount.should.be.bignumber.that.equals(depositAmount)
      })
    })

    it('Deposit amount should be credited to deposit receiver', async() => {
      const newAccountBalance = await contracts.dummyERC20.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit called by non depositor account', () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let dummyERC20

    before(async() => {
      const contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC20 = contracts.dummyERC20
    })

    it('Tx should revert with proper reason', async() => {
      await expectRevert(
        dummyERC20.deposit(depositReceiver, depositData, { from: accounts[1] }),
        'Transaction has been reverted by the EVM'
      )
    })
  })

  describe('Should burn tokens on withdraw', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const user = accounts[0]
    let contracts
    let oldAccountBalance
    let withdrawTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC20.DEPOSITOR_ROLE()
      await contracts.dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await contracts.dummyERC20.deposit(user, depositData)
      oldAccountBalance = await contracts.dummyERC20.balanceOf(user)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.dummyERC20.withdraw(withdrawAmount)
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.dummyERC20.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferLog.args.value.toString())
        transferLogAmount.should.be.bignumber.that.equals(withdrawAmount)
      })
    })

    it('Withdraw amount should be deducted from user', async() => {
      const newAccountBalance = await contracts.dummyERC20.balanceOf(user)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(withdrawAmount)
      )
    })
  })
})
