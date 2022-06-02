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

contract('MintableERC20Predicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]

    let dummyMintableERC20
    let mintableERC20Predicate
    let oldAccountBalance
    let oldContractBalance
    let lockTokensTx
    let lockedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)

      const burnLog = getERC20TransferLog({
        from: depositor,
        to: mockValues.zeroAddress,
        amount: depositAmount
      })
            // because it's a mintable ERC20, we're first going to exit it and
            // predicate will mint that much amount for us and send it back
            // to `depositor`, which is going to be approved to predicate, so that
            // it can get it transferred to itself
            await mintableERC20Predicate.exitTokens(depositor, dummyMintableERC20.address, burnLog)
            await dummyMintableERC20.approve(mintableERC20Predicate.address, depositAmount, { from: depositor })

            oldAccountBalance = await dummyMintableERC20.balanceOf(depositor)
            oldContractBalance = await dummyMintableERC20.balanceOf(mintableERC20Predicate.address)
          })

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.at.most(oldAccountBalance)
    })

    it('Depositor should have approved proper amount', async () => {
      const allowance = await dummyMintableERC20.allowance(depositor, mintableERC20Predicate.address)
      allowance.should.be.a.bignumber.that.equals(depositAmount)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      lockTokensTx = await mintableERC20Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC20.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedMintableERC20 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedMintableERC20')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedMintableERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          mintableERC20Predicate.address.toLowerCase()
          )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit correct deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })

      it('Should emit correct root token', () => {
        lockedLog.args.rootToken.should.equal(dummyMintableERC20.address)
      })

      it('Should emit correct amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyMintableERC20.balanceOf(depositor)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
        )
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyMintableERC20.balanceOf(mintableERC20Predicate.address)
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
    let dummyMintableERC20
    let mintableERC20Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)

      const burnLog = getERC20TransferLog({
        from: depositor,
        to: mockValues.zeroAddress,
        amount: depositAmount
      })
      await mintableERC20Predicate.exitTokens(depositor, dummyMintableERC20.address, burnLog)
      await dummyMintableERC20.approve(mintableERC20Predicate.address, depositAmount, { from: depositor })

      await dummyMintableERC20.approve(mintableERC20Predicate.address, depositAmount, { from: depositor })
    })

    it('Should revert with correct reason', async () => {
      await expectRevert(
        mintableERC20Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC20.address, depositData, { from: depositor }),
        'MintableERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens by Alice then deposit back and exitTokens for second time by Bob', () => {
    const amount = mockValues.amounts[2]
    const alice = accounts[2]
    const bob = mockValues.addresses[8]
    
    let dummyMintableERC20
    let mintableERC20Predicate
    let exitTokensTx
    let exitedLog
    
    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)
    })
    
    it('Predicate should have 0 balance', async() => {
      (await dummyMintableERC20.balanceOf(mintableERC20Predicate.address)).should.be.a.bignumber.equals(new BN(0))
    })
    
    it('Alice should be able to send exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: alice,
        to: mockValues.zeroAddress,
        amount: amount
      })
      exitTokensTx = await mintableERC20Predicate.exitTokens(alice, dummyMintableERC20.address, burnLog)
      should.exist(exitTokensTx)
    })
    
    it('Amount should be minted for Alice', async() => {
      (await dummyMintableERC20.balanceOf(alice)).should.be.a.bignumber.equals(amount)
    })
    
    it('Alice should be able to deposit amount back', async() => {
      await dummyMintableERC20.approve(mintableERC20Predicate.address, amount, { from: alice })
      const depositData = abi.encode(['uint256'], [amount.toString()])
      const lockTokensTx = await mintableERC20Predicate.lockTokens(alice, alice, dummyMintableERC20.address, depositData)
      should.exist(lockTokensTx)
    })
    
    it('Amount should be transfered to mintableERC20Predicate', async() => {
      (await dummyMintableERC20.balanceOf(mintableERC20Predicate.address)).should.be.a.bignumber.equals(amount)
    })
    
    it('Bob should be able to send exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        amount: amount
      })
      exitTokensTx = await mintableERC20Predicate.exitTokens(bob, dummyMintableERC20.address, burnLog)
      should.exist(exitTokensTx)
    })
    
    it('Amount should be transfered to Bob', async() => {
      (await dummyMintableERC20.balanceOf(bob)).should.be.a.bignumber.equals(amount)
    })
  })

  describe('exitTokens called by different user', () => {
    const amount = mockValues.amounts[2]
    const alice = accounts[2]
    const bob = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[3]
    
    let dummyMintableERC20
    let mintableERC20Predicate
    let exitTokensTx
    let exitedLog
    
    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)
    })
    
    it('exitCaller should be able to send exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: alice,
        to: mockValues.zeroAddress,
        amount: amount
      })
      exitTokensTx = await mintableERC20Predicate.exitTokens(exitCaller, dummyMintableERC20.address, burnLog)
      should.exist(exitTokensTx)
    })
    
    it('Amount should be minted for alice', async() => {
      (await dummyMintableERC20.balanceOf(alice)).should.be.a.bignumber.equals(amount)
    })
    
    it('Alice should be able to deposit token back', async() => {
      await dummyMintableERC20.approve(mintableERC20Predicate.address, amount, { from: alice })
      const depositData = abi.encode(['uint256'], [amount.toString()])
      const lockTokensTx = await mintableERC20Predicate.lockTokens(alice, alice, dummyMintableERC20.address, depositData)
      should.exist(lockTokensTx)
    })
    
    it('Amount should be transfered to mintableERC20Predicate', async() => {
      (await dummyMintableERC20.balanceOf(mintableERC20Predicate.address)).should.be.a.bignumber.equals(amount)
    })
    
    it('exitCaller should be able to send exitTokens tx', async() => {
      const burnLog = getERC20TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        amount: amount
      })
      exitTokensTx = await mintableERC20Predicate.exitTokens(exitCaller, dummyMintableERC20.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedMintableERC20 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedMintableERC20')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedMintableERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          mintableERC20Predicate.address.toLowerCase()
          )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(bob)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyMintableERC20.address)
      })

      it('Should emit correct amount', () => {
        const exitedLogAmount = new BN(exitedLog.args.amount.toString())
        exitedLogAmount.should.be.bignumber.that.equals(amount)
      })
    })
    
    it('Token should be transfered to bob', async() => {
      (await dummyMintableERC20.balanceOf(bob)).should.be.a.bignumber.equals(amount)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const amount = mockValues.amounts[2]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC20
    let mintableERC20Predicate
    
    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)
    })

    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: amount
      })
      await expectRevert(mintableERC20Predicate.exitTokens(withdrawer, dummyMintableERC20.address, burnLog), 'MintableERC20Predicate: INVALID_SIGNATURE')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const amount = mockValues.amounts[2]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC20
    let mintableERC20Predicate
    
    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)
    })
    
    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: amount
      })
      await expectRevert(mintableERC20Predicate.exitTokens(withdrawer, dummyMintableERC20.address, burnLog), 'MintableERC20Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const amount = mockValues.amounts[2]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC20
    let mintableERC20Predicate
    
    before(async() => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC20 = contracts.dummyMintableERC20
      mintableERC20Predicate = contracts.mintableERC20Predicate

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.address)
    })
    
    it('Should revert with correct reason', async() => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: amount
      })
      await expectRevert(
        mintableERC20Predicate.exitTokens(withdrawer, dummyMintableERC20.address, burnLog, { from: accounts[2] }),
        'MintableERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
