import { AbiCoder } from 'ethers'
import { deployFreshRootContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getERC20TransferLog } from '../helpers/logs.js'
import { mockValues, etherAddress } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('EtherPredicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let etherPredicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expect(etherPredicate.lockTokens(depositor.address, depositReceiver, etherAddress, depositData))
        .to.emit(etherPredicate, 'LockedEther')
        .withArgs(depositor.address, depositReceiver, depositAmount)
    })

    // @note Already verified in the above test
    // it('Should emit LockedEther log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedEther')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedEther log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       etherPredicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit correct amount', () => {
    //     const lockedLogAmount = new BN(lockedLog.args.amount.toString())
    //     lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })
    // })
  })

  describe('lockTokens called by non manager', () => {
    const depositAmount = mockValues.amounts[3]
    let depositor
    const depositReceiver = accounts[2]
    let etherPredicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should revert with correct reason', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expect(
        etherPredicate.connect(depositor).lockTokens(depositor.address, depositReceiver, etherAddress, depositData)
      ).to.be.revertedWith('EtherPredicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Send ether to predicate', () => {
    const depositAmount = mockValues.amounts[3]
    let manager
    let nonManager
    let etherPredicate

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      nonManager = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
    })

    it('Should accept from manager', async () => {
      const tx = await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
      const newBalance = await ethers.provider.getBalance(etherPredicate.target)
      expect(newBalance).to.equal(depositAmount)
    })

    it('Should reject from non manager', async () => {
      await expect(
        nonManager.sendTransaction({
          to: etherPredicate.target,
          value: depositAmount
        })
      ).to.be.revertedWith('EtherPredicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let etherPredicate
    let manager
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
      oldAccountBalance = await ethers.provider.getBalance(withdrawer)
      oldContractBalance = await ethers.provider.getBalance(etherPredicate.target)
    })

    it('Predicate should have balance', () => {
      expect(oldContractBalance).to.be.gt(withdrawAmount)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      await expect(etherPredicate.exitTokens(etherPredicate.target, etherAddress, burnLog))
        .to.emit(etherPredicate, 'ExitedEther')
        .withArgs(withdrawer, withdrawAmount)
    })

    it('Withdraw amount should be deducted from contract', async () => {
      const newContractBalance = await ethers.provider.getBalance(etherPredicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })

    it('Withdraw amount should be credited to correct address', async () => {
      const newAccountBalance = await ethers.provider.getBalance(withdrawer)
      expect(newAccountBalance).to.equal(oldAccountBalance + withdrawAmount)
    })
  })

  describe('exitTokens called by different user', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let etherPredicate
    let manager
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
      oldAccountBalance = await ethers.provider.getBalance(withdrawer)
      oldContractBalance = await ethers.provider.getBalance(etherPredicate.target)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      await expect(etherPredicate.exitTokens(etherPredicate.target, etherAddress, burnLog))
        .to.emit(etherPredicate, 'ExitedEther')
        .withArgs(withdrawer, withdrawAmount)
    })

    it('Withdraw amount should be deducted from contract', async () => {
      const newContractBalance = await ethers.provider.getBalance(etherPredicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })

    it('Withdraw amount should be credited to correct address', async () => {
      const newAccountBalance = await ethers.provider.getBalance(withdrawer)
      expect(newAccountBalance).to.equal(oldAccountBalance + withdrawAmount)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let manager
    let etherPredicate

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })
      await expect(etherPredicate.exitTokens(etherPredicate.target, etherAddress, burnLog)).to.be.revertedWith(
        'EtherPredicate: INVALID_SIGNATURE'
      )
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let manager
    let etherPredicate

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expect(etherPredicate.exitTokens(etherPredicate.target, etherAddress, burnLog)).to.be.revertedWith(
        'EtherPredicate: INVALID_RECEIVER'
      )
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let etherPredicate
    let manager
    let nonManager

    before(async () => {
      manager = await ethers.getSigner(accounts[0])
      nonManager = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      etherPredicate = contracts.etherPredicate
      await manager.sendTransaction({
        to: etherPredicate.target,
        value: depositAmount
      })
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })
      await expect(
        etherPredicate.connect(nonManager).exitTokens(etherPredicate.target, etherAddress, burnLog)
      ).to.be.revertedWith('EtherPredicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
