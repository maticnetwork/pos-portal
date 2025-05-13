import { constructERC1155DepositData } from '../helpers/utils.js'
import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues } from '../helpers/constants.js'

contract('ChildERC1155', (accounts) => {
  describe('Should mint tokens on deposit', () => {
    const tokenId = mockValues.numbers[8]
    const depositAmount = mockValues.amounts[7]
    const user = mockValues.addresses[3]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    let contracts
    let oldAccountBalance

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      oldAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
      const DEPOSITOR_ROLE = await contracts.dummyERC1155.DEPOSITOR_ROLE()
      await contracts.dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Can receive deposit tx', async () => {
      await expect(contracts.dummyERC1155.deposit(user, depositData))
        .to.emit(contracts.dummyERC1155, 'TransferBatch')
        .withArgs(accounts[0], mockValues.zeroAddress, user, [tokenId], [depositAmount])
    })

    // @note Already verified in the above test
    // it('Should emit TransferBatch log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'TransferBatch')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in TransferBatch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC1155.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferLog.args.operator.should.equal(accounts[0])
    //   })

    //   it('Should emit proper from', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper to', () => {
    //     transferLog.args.to.should.equal(user)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog.args.ids[0]
    //     transferLogTokenId.toNumber().should.equal(tokenId)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[0].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit amount should be credited to deposit receiver', async () => {
      const newAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
      expect(newAccountBalance).to.be.equals(depositAmount + oldAccountBalance)
    })
  })

  describe('Deposit called by non depositor account', () => {
    const tokenId = mockValues.numbers[8]
    const depositAmount = mockValues.amounts[7]
    const user = mockValues.addresses[3]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    let dummyERC1155

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
    })

    it('Tx should revert with proper reason', async () => {
      await expect(
        dummyERC1155.connect(await ethers.getSigner(accounts[1])).deposit(user, depositData)
      ).to.be.revertedWith('ChildERC1155: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Should burn tokens on withdrawSingle', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    const user = accounts[0]
    let contracts
    let oldAccountBalance
    // let withdrawTx
    // let transferSingleLog

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      const DEPOSITOR_ROLE = await contracts.dummyERC1155.DEPOSITOR_ROLE()
      await contracts.dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC1155.deposit(user, depositData)
      oldAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
    })

    it('Can receive withdraw tx', async () => {
      await expect(contracts.dummyERC1155.withdrawSingle(tokenId, withdrawAmount))
        .to.emit(contracts.dummyERC1155, 'TransferSingle')
        .withArgs(user, user, mockValues.zeroAddress, tokenId, withdrawAmount)
    })

    // @note Already verified in the above test
    // it('Should emit TransferSingle log', () => {
    //   const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
    //   transferSingleLog = logs.find(l => l.event === 'TransferSingle')
    //   should.exist(transferSingleLog)
    // })

    // describe('Correct values should be emitted in TransferSingle log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferSingleLog.address.should.equal(
    //       contracts.dummyERC1155.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferSingleLog.args.operator.should.equal(user)
    //   })

    //   it('Should emit proper From', () => {
    //     transferSingleLog.args.from.should.equal(user)
    //   })

    //   it('Should emit proper To', () => {
    //     transferSingleLog.args.to.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferSingleLog.args.value.toString())
    //     transferLogAmount.should.be.bignumber.that.equals(withdrawAmount)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferSingleLog.args.id
    //     transferLogTokenId.toNumber().should.equal(tokenId)
    //   })
    // })

    it('Withdraw amount should be deducted from user', async () => {
      const newAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
      expect(newAccountBalance).to.be.equals(oldAccountBalance - withdrawAmount)
    })
  })

  describe('Should mint tokens on deposit batch', () => {
    const tokenIdA = mockValues.numbers[8]
    const tokenIdB = mockValues.numbers[6]
    const tokenIdC = mockValues.numbers[1]
    const depositAmountA = mockValues.amounts[5]
    const depositAmountB = mockValues.amounts[3]
    const depositAmountC = mockValues.amounts[9]
    const user = mockValues.addresses[0]
    const depositData = constructERC1155DepositData(
      [tokenIdA, tokenIdB, tokenIdC],
      [depositAmountA, depositAmountB, depositAmountC]
    )
    let contracts
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldAccountBalanceC
    // let depositTx
    // let transferLog

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      oldAccountBalanceA = await contracts.dummyERC1155.balanceOf(user, tokenIdA)
      oldAccountBalanceB = await contracts.dummyERC1155.balanceOf(user, tokenIdB)
      oldAccountBalanceC = await contracts.dummyERC1155.balanceOf(user, tokenIdC)
      const DEPOSITOR_ROLE = await contracts.dummyERC1155.DEPOSITOR_ROLE()
      await contracts.dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Can receive deposit tx', async () => {
      await expect(contracts.dummyERC1155.deposit(user, depositData))
        .to.emit(contracts.dummyERC1155, 'TransferBatch')
        .withArgs(
          accounts[0],
          mockValues.zeroAddress,
          user,
          [tokenIdA, tokenIdB, tokenIdC],
          [depositAmountA, depositAmountB, depositAmountC]
        )
    })

    // @note Already verified in the above test
    // it('Should emit TransferBatch log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'TransferBatch')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in TransferBatch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC1155.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferLog.args.operator.should.equal(accounts[0])
    //   })

    //   it('Should emit proper from', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper to', () => {
    //     transferLog.args.to.should.equal(user)
    //   })

    //   it('Should emit correct tokenId for A', () => {
    //     const transferLogTokenId = transferLog.args.ids[0]
    //     transferLogTokenId.toNumber().should.equal(tokenIdA)
    //   })

    //   it('Should emit correct tokenId for B', () => {
    //     const transferLogTokenId = transferLog.args.ids[1]
    //     transferLogTokenId.toNumber().should.equal(tokenIdB)
    //   })

    //   it('Should emit correct tokenId for C', () => {
    //     const transferLogTokenId = transferLog.args.ids[2]
    //     transferLogTokenId.toNumber().should.equal(tokenIdC)
    //   })

    //   it('Should emit correct amount for A', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[0].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountA)
    //   })

    //   it('Should emit correct amount for B', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[1].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountB)
    //   })

    //   it('Should emit correct amount for C', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[2].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountC)
    //   })
    // })

    it('Deposit amounts should be credited to deposit receiver', async () => {
      const balanceA = await contracts.dummyERC1155.balanceOf(user, tokenIdA)
      const balanceB = await contracts.dummyERC1155.balanceOf(user, tokenIdB)
      const balanceC = await contracts.dummyERC1155.balanceOf(user, tokenIdC)
      expect(balanceA).to.be.equals(depositAmountA + oldAccountBalanceA)
      expect(balanceB).to.be.equals(depositAmountB + oldAccountBalanceB)
      expect(balanceC).to.be.equals(depositAmountC + oldAccountBalanceC)
    })
  })

  describe('Should burn tokens on withdrawBatch', () => {
    const withdrawAmountA = mockValues.amounts[2]
    const withdrawAmountB = mockValues.amounts[2]
    const withdrawAmountC = mockValues.amounts[1]
    const depositAmountA = withdrawAmountA + mockValues.amounts[0]
    const depositAmountB = withdrawAmountB + mockValues.amounts[9]
    const depositAmountC = withdrawAmountC + mockValues.amounts[6]
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const tokenIdC = mockValues.numbers[8]
    const user = accounts[0]
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldAccountBalanceC
    let contracts

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const depositData = constructERC1155DepositData(
        [tokenIdA, tokenIdB, tokenIdC],
        [depositAmountA, depositAmountB, depositAmountC]
      )
      const DEPOSITOR_ROLE = await contracts.dummyERC1155.DEPOSITOR_ROLE()
      await contracts.dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC1155.deposit(user, depositData)
      oldAccountBalanceA = await contracts.dummyERC1155.balanceOf(user, tokenIdA)
      oldAccountBalanceB = await contracts.dummyERC1155.balanceOf(user, tokenIdB)
      oldAccountBalanceC = await contracts.dummyERC1155.balanceOf(user, tokenIdC)
    })

    it('Can receive withdraw tx', async () => {
      await expect(
        contracts.dummyERC1155.withdrawBatch(
          [tokenIdA, tokenIdB, tokenIdC],
          [withdrawAmountA, withdrawAmountB, withdrawAmountC]
        )
      )
        .to.emit(contracts.dummyERC1155, 'TransferBatch')
        .withArgs(
          user,
          user,
          mockValues.zeroAddress,
          [tokenIdA, tokenIdB, tokenIdC],
          [withdrawAmountA, withdrawAmountB, withdrawAmountC]
        )
    })

    // @note Already verified in the above test
    // it('Should emit TransferBatch log', () => {
    //   const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
    //   transferBatchLog = logs.find(l => l.event === 'TransferBatch')
    //   should.exist(transferBatchLog)
    // })

    // describe('Correct values should be emitted in TransferBatch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferBatchLog.address.should.equal(
    //       contracts.dummyERC1155.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferBatchLog.args.operator.should.equal(user)
    //   })

    //   it('Should emit proper From', () => {
    //     transferBatchLog.args.from.should.equal(user)
    //   })

    //   it('Should emit proper To', () => {
    //     transferBatchLog.args.to.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit correct amount for A', () => {
    //     const transferLogAmount = new BN(transferBatchLog.args.values[0].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(withdrawAmountA)
    //   })

    //   it('Should emit correct amount for B', () => {
    //     const transferLogAmount = new BN(transferBatchLog.args.values[1].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(withdrawAmountB)
    //   })

    //   it('Should emit correct amount for C', () => {
    //     const transferLogAmount = new BN(transferBatchLog.args.values[2].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(withdrawAmountC)
    //   })

    //   it('Should emit correct tokenId for A', () => {
    //     const transferLogTokenId = transferBatchLog.args.ids[0]
    //     transferLogTokenId.toNumber().should.equal(tokenIdA)
    //   })

    //   it('Should emit correct tokenId for B', () => {
    //     const transferLogTokenId = transferBatchLog.args.ids[1]
    //     transferLogTokenId.toNumber().should.equal(tokenIdB)
    //   })

    //   it('Should emit correct tokenId for C', () => {
    //     const transferLogTokenId = transferBatchLog.args.ids[2]
    //     transferLogTokenId.toNumber().should.equal(tokenIdC)
    //   })
    // })

    it('Withdraw amounts should be deducted from user', async () => {
      const balanceA = await contracts.dummyERC1155.balanceOf(user, tokenIdA)
      const balanceB = await contracts.dummyERC1155.balanceOf(user, tokenIdB)
      const balanceC = await contracts.dummyERC1155.balanceOf(user, tokenIdC)
      expect(balanceA).to.be.equals(oldAccountBalanceA - withdrawAmountA)
      expect(balanceB).to.be.equals(oldAccountBalanceB - withdrawAmountB)
      expect(balanceC).to.be.equals(oldAccountBalanceC - withdrawAmountC)
    })
  })
})
