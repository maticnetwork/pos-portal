import { AbiCoder } from 'ethers'
import { deployFreshRootContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getERC20TransferLog } from '../helpers/logs.js'
import { mockValues } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ERC20Predicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate

      await dummyERC20.transfer(depositor.address, depositAmount)
      oldAccountBalance = await dummyERC20.balanceOf(depositor.address)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)

      await dummyERC20.connect(depositor).approve(erc20Predicate.target, depositAmount)
    })

    it('Depositor should have proper balance', () => {
      expect(oldAccountBalance).to.be.at.least(depositAmount)
    })

    it('Depositor should have approved proper amount', async () => {
      const allowance = await dummyERC20.allowance(depositor.address, erc20Predicate.target)
      expect(allowance).to.equal(depositAmount)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expect(erc20Predicate.lockTokens(depositor.address, depositReceiver, dummyERC20.target, depositData))
        .to.emit(erc20Predicate, 'LockedERC20')
        .withArgs(depositor.address, depositReceiver, dummyERC20.target, depositAmount)
    })

    // @note Already verified in the above test
    // it('Should emit LockedERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedERC20')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.target.should.equal(
    //       erc20Predicate.target.toLowerCase()
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

    //   it('Should emit correct root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyERC20.target)
    //   })
    // })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(depositor.address)
      expect(newAccountBalance).to.equal(oldAccountBalance - depositAmount)
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance + depositAmount)
    })
  })

  describe('lockTokens called by non manager', () => {
    const depositAmount = mockValues.amounts[3]
    const depositReceiver = accounts[2]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let depositor
    let dummyERC20
    let erc20Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate

      await dummyERC20.connect(depositor).approve(erc20Predicate.target, depositAmount)
    })

    it('Should revert with correct reason', async () => {
      await expect(
        erc20Predicate.connect(depositor).lockTokens(depositor.address, depositReceiver, dummyERC20.target, depositData)
      ).to.be.revertedWith('ERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate

      await dummyERC20.approve(erc20Predicate.target, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.target, depositData)

      oldAccountBalance = await dummyERC20.balanceOf(withdrawer)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)
    })

    it('Predicate should have balance', () => {
      expect(oldContractBalance).to.be.at.least(withdrawAmount)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })

      await expect(erc20Predicate.exitTokens(dummyERC20.target, dummyERC20.target, burnLog))
        .to.emit(erc20Predicate, 'ExitedERC20')
        .withArgs(withdrawer, dummyERC20.target, withdrawAmount)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC20')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.target.should.equal(
    //       erc20Predicate.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit correct amount', () => {
    //     const exitedLogAmount = new BN(exitedLog.args.amount.toString())
    //     exitedLogAmount.should.be.bignumber.that.equals(withdrawAmount)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyERC20.target)
    //   })
    // })

    it('Withdraw amount should be deducted from contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })

    it('Withdraw amount should be credited to correct address', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(withdrawer)
      expect(newAccountBalance).to.equal(oldAccountBalance + withdrawAmount)
    })
  })

  describe('exitTokens called by different user', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.target, depositAmount)

      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.target, depositData)

      oldAccountBalance = await dummyERC20.balanceOf(withdrawer)
      oldContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })

      await expect(erc20Predicate.exitTokens(dummyERC20.target, dummyERC20.target, burnLog))
        .to.emit(erc20Predicate, 'ExitedERC20')
        .withArgs(withdrawer, dummyERC20.target, withdrawAmount)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC20')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.target.should.equal(
    //       erc20Predicate.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit correct amount', () => {
    //     const exitedLogAmount = new BN(exitedLog.args.amount.toString())
    //     exitedLogAmount.should.be.bignumber.that.equals(withdrawAmount)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyERC20.target)
    //   })
    // })

    it('Withdraw amount should be deducted from contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })

    it('Withdraw amount should be credited to correct address', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(withdrawer)
      expect(newAccountBalance).to.equal(oldAccountBalance + withdrawAmount)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.target, depositAmount)

      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: withdrawAmount
      })

      await expect(erc20Predicate.exitTokens(dummyERC20.target, dummyERC20.target, burnLog)).to.be.revertedWith(
        'ERC20Predicate: INVALID_SIGNATURE'
      )
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let dummyERC20
    let erc20Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.target, depositAmount)

      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })

      await expect(erc20Predicate.exitTokens(dummyERC20.target, dummyERC20.target, burnLog)).to.be.revertedWith(
        'ERC20Predicate: INVALID_RECEIVER'
      )
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const withdrawer = mockValues.addresses[8]
    let depositor
    let dummyERC20
    let erc20Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[2])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      erc20Predicate = contracts.erc20Predicate
      await dummyERC20.approve(erc20Predicate.target, depositAmount)

      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await erc20Predicate.lockTokens(accounts[0], withdrawer, dummyERC20.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: withdrawAmount
      })

      await expect(
        erc20Predicate.connect(depositor).exitTokens(dummyERC20.target, dummyERC20.target, burnLog)
      ).to.be.revertedWith('ERC20Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
