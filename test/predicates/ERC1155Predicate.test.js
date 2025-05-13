import { deployFreshRootContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getERC1155TransferSingleLog, getERC1155TransferBatchLog } from '../helpers/logs.js'
import { mockValues } from '../helpers/constants.js'
import { constructERC1155DepositData } from '../helpers/utils.js'

contract('ERC1155Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenIdA = mockValues.numbers[2]
    const tokenIdB = mockValues.numbers[7]
    const amountA = mockValues.amounts[0]
    const amountB = mockValues.amounts[1]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC1155
    let erc1155Predicate
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate

      await dummyERC1155.mint(depositor, tokenIdA, amountA)
      await dummyERC1155.mint(depositor, tokenIdB, amountB)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      oldAccountBalanceA = await dummyERC1155.balanceOf(depositor.address, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(depositor.address, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
    })

    it('Depositor should have balance', async () => {
      const balanceA = await dummyERC1155.balanceOf(depositor.address, tokenIdA)
      const balanceB = await dummyERC1155.balanceOf(depositor.address, tokenIdB)
      expect(balanceA).to.be.gte(amountA)
      expect(balanceB).to.be.gte(amountB)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyERC1155.isApprovedForAll(depositor.address, erc1155Predicate.target)
      expect(approved).to.be.true
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])
      await expect(erc1155Predicate.lockTokens(depositor.address, depositReceiver, dummyERC1155.target, depositData))
        .to.emit(erc1155Predicate, 'LockedBatchERC1155')
        .withArgs(depositor.address, depositReceiver, dummyERC1155.target, [tokenIdA, tokenIdB], [amountA, amountB])
    })

    // @note Already verified in the above test
    // it('Should emit LockedBatchERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedBatchERC1155')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedBatchERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       erc1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit proper deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })

    //   it('Should emit proper root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyERC1155.address)
    //   })

    //   it('Should emit proper token id for A', () => {
    //     const id = lockedLog.args.ids[0].toNumber()
    //     id.should.equal(tokenIdA)
    //   })

    //   it('Should emit proper token id for B', () => {
    //     const id = lockedLog.args.ids[1].toNumber()
    //     id.should.equal(tokenIdB)
    //   })

    //   it('Should emit proper amount for A', () => {
    //     const amounts = lockedLog.args.amounts
    //     const amount = new BN(amounts[0].toString())
    //     amount.should.be.a.bignumber.that.equals(amountA)
    //   })

    //   it('Should emit proper amount for B', () => {
    //     const amounts = lockedLog.args.amounts
    //     const amount = new BN(amounts[1].toString())
    //     amount.should.be.a.bignumber.that.equals(amountB)
    //   })
    // })

    it('Deposit amount should be deducted from depositor account for A', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositor, tokenIdA)
      expect(newAccountBalance).to.equal(oldAccountBalanceA - amountA)
    })

    it('Deposit amount should be deducted from depositor account for B', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositor, tokenIdB)
      expect(newAccountBalance).to.equal(oldAccountBalanceB - amountB)
    })

    it('Deposit amount should be credited to correct contract for A', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      expect(newContractBalance).to.equal(oldContractBalanceA + amountA)
    })

    it('Deposit amount should be credited to correct contract for B', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
      expect(newContractBalance).to.equal(oldContractBalanceB + amountB)
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const amount = mockValues.amounts[9]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC1155
    let erc1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate

      await dummyERC1155.mint(depositor, tokenId, amount)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
    })

    it('Should revert with correct reason', async () => {
      const depositData = constructERC1155DepositData([tokenId], [amount])
      await expect(
        erc1155Predicate
          .connect(depositor)
          .lockTokens(depositor.address, depositReceiver, dummyERC1155.target, depositData)
      ).to.be.revertedWith('ERC1155Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens single', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    let depositor
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate

      await dummyERC1155.mint(depositor.address, tokenId, depositAmount)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
      oldAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenId)
      oldContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenId)
    })

    it('Predicate should have the token', async () => {
      expect(withdrawAmount).to.be.lte(oldContractBalance)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        amount: withdrawAmount
      })

      await expect(erc1155Predicate.exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog))
        .to.emit(erc1155Predicate, 'ExitedERC1155')
        .withArgs(withdrawer, dummyERC1155.target, tokenId, withdrawAmount)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyERC1155.address)
    //   })

    //   it('Should emit proper token id', () => {
    //     const id = exitedLog.args.id.toNumber()
    //     id.should.equal(tokenId)
    //   })

    //   it('Should emit proper amount', () => {
    //     const exitedLogAmount = new BN(exitedLog.args.amount.toString())
    //     exitedLogAmount.should.be.a.bignumber.that.equals(withdrawAmount)
    //   })
    // })

    it('Withdaw amount should be deducted from contract', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })

    it('Withdraw amount should be credited to withdrawer', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenId)
      expect(newAccountBalance).to.equal(oldAccountBalance + withdrawAmount)
    })
  })

  describe('exitTokens batch', () => {
    const withdrawAmountA = mockValues.amounts[9]
    const withdrawAmountB = mockValues.amounts[8]
    const depositAmountA = withdrawAmountA + mockValues.amounts[3]
    const depositAmountB = withdrawAmountB + mockValues.amounts[4]
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    let depositor
    const withdrawer = mockValues.addresses[8]
    let dummyERC1155
    let erc1155Predicate
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate

      await dummyERC1155.mint(depositor.address, tokenIdA, depositAmountA)
      await dummyERC1155.mint(depositor.address, tokenIdB, depositAmountB)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
      oldAccountBalanceA = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
    })

    it('Predicate should have the token balances', async () => {
      expect(withdrawAmountA).to.be.lte(oldContractBalanceA)
      expect(withdrawAmountB).to.be.lte(oldContractBalanceB)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [withdrawAmountA, withdrawAmountB]
      })

      await expect(erc1155Predicate.exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog))
        .to.emit(erc1155Predicate, 'ExitedBatchERC1155')
        .withArgs(withdrawer, dummyERC1155.target, [tokenIdA, tokenIdB], [withdrawAmountA, withdrawAmountB])
    })

    // @note Already verified in the above test
    // it('Should emit ExitedBatchERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedBatchERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedBatchERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyERC1155.address)
    //   })

    //   it('Should emit proper token id for A', () => {
    //     const id = exitedLog.args.ids[0].toNumber()
    //     id.should.equal(tokenIdA)
    //   })

    //   it('Should emit proper token id for B', () => {
    //     const id = exitedLog.args.ids[1].toNumber()
    //     id.should.equal(tokenIdB)
    //   })

    //   it('Should emit proper amount for A', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[0].toString())
    //     amount.should.be.a.bignumber.that.equals(withdrawAmountA)
    //   })

    //   it('Should emit proper amount for B', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[1].toString())
    //     amount.should.be.a.bignumber.that.equals(withdrawAmountB)
    //   })
    // })

    it('Withdaw amount should be deducted from contract for A', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      expect(newContractBalance).to.equal(oldContractBalanceA - withdrawAmountA)
    })

    it('Withdaw amount should be deducted from contract for B', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
      expect(newContractBalance).to.equal(oldContractBalanceB - withdrawAmountB)
    })

    it('Withdraw amount should be credited to withdrawer for A', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      expect(newAccountBalance).to.equal(oldAccountBalanceA + withdrawAmountA)
    })

    it('Withdraw amount should be credited to withdrawer for B', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      expect(newAccountBalance).to.equal(oldAccountBalanceB + withdrawAmountB)
    })
  })

  describe('exitTokens called by different user', () => {
    const withdrawAmountA = mockValues.amounts[9]
    const withdrawAmountB = mockValues.amounts[8]
    const depositAmountA = withdrawAmountA + mockValues.amounts[3]
    const depositAmountB = withdrawAmountB + mockValues.amounts[4]
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[5]
    let depositor
    let dummyERC1155
    let erc1155Predicate
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor.address, tokenIdA, depositAmountA)
      await dummyERC1155.mint(depositor.address, tokenIdB, depositAmountB)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [depositAmountA, depositAmountB])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
      oldAccountBalanceA = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [withdrawAmountA, withdrawAmountB]
      })
      await expect(erc1155Predicate.exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog))
        .to.emit(erc1155Predicate, 'ExitedBatchERC1155')
        .withArgs(withdrawer, dummyERC1155.target, [tokenIdA, tokenIdB], [withdrawAmountA, withdrawAmountB])
    })

    // @note Already verified in the above test
    // it('Should emit ExitedBatchERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedBatchERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedBatchERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyERC1155.address)
    //   })

    //   it('Should emit proper token id for A', () => {
    //     const id = exitedLog.args.ids[0].toNumber()
    //     id.should.equal(tokenIdA)
    //   })

    //   it('Should emit proper token id for B', () => {
    //     const id = exitedLog.args.ids[1].toNumber()
    //     id.should.equal(tokenIdB)
    //   })

    //   it('Should emit proper amount for A', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[0].toString())
    //     amount.should.be.a.bignumber.that.equals(withdrawAmountA)
    //   })

    //   it('Should emit proper amount for B', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[1].toString())
    //     amount.should.be.a.bignumber.that.equals(withdrawAmountB)
    //   })
    // })

    it('Withdaw amount should be deducted from contract for A', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdA)
      expect(newContractBalance).to.equal(oldContractBalanceA - withdrawAmountA)
    })

    it('Withdaw amount should be deducted from contract for B', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.target, tokenIdB)
      expect(newContractBalance).to.equal(oldContractBalanceB - withdrawAmountB)
    })

    it('Withdraw amount should be credited to withdrawer for A', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdA)
      expect(newAccountBalance).to.equal(oldAccountBalanceA + withdrawAmountA)
    })

    it('Withdraw amount should be credited to withdrawer for B', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(withdrawer, tokenIdB)
      expect(newAccountBalance).to.equal(oldAccountBalanceB + withdrawAmountB)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    const withdrawer = mockValues.addresses[8]
    let depositor
    let dummyERC1155
    let erc1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor.address, tokenId, depositAmount)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        overrideSig: mockValues.bytes32[2],
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expect(erc1155Predicate.exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog)).to.be.revertedWith(
        'ERC1155Predicate: INVALID_WITHDRAW_SIG'
      )
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    const withdrawer = mockValues.addresses[8]
    let depositor
    let dummyERC1155
    let erc1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor.address, tokenId, depositAmount)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expect(erc1155Predicate.exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog)).to.be.revertedWith(
        'ERC1155Predicate: INVALID_RECEIVER'
      )
    })
  })

  describe('exitTokens called by non manager', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    const withdrawer = mockValues.addresses[8]
    let depositor
    let dummyERC1155
    let erc1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      erc1155Predicate = contracts.erc1155Predicate
      await dummyERC1155.mint(depositor.address, tokenId, depositAmount)
      await dummyERC1155.connect(depositor).setApprovalForAll(erc1155Predicate.target, true)
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      await erc1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyERC1155.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId,
        amount: withdrawAmount
      })
      await expect(
        erc1155Predicate
          .connect(await ethers.getSigner(accounts[2]))
          .exitTokens(dummyERC1155.target, dummyERC1155.target, burnLog)
      ).to.be.revertedWith('ERC1155Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
