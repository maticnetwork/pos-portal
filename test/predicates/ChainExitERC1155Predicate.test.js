import { constructERC1155DepositData } from '../helpers/utils.js'
import { deployFreshRootContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getERC1155ChainExitLog } from '../helpers/logs.js'
import { mockValues } from '../helpers/constants.js'

contract('ChainExitERC1155Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenIdA = mockValues.numbers[2]
    const tokenIdB = mockValues.numbers[7]
    const amountA = mockValues.amounts[0]
    const amountB = mockValues.amounts[1]
    const depositReceiver = mockValues.addresses[7]
    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB])

    let depositor
    let dummyMintableERC1155
    let chainExitERC1155Predicate
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldContractBalanceA
    let oldContractBalanceB

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      chainExitERC1155Predicate = contracts.chainExitERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, chainExitERC1155Predicate.target)

      await dummyMintableERC1155.mintBatch(depositor, [tokenIdA, tokenIdB], [amountA, amountB], '0x')
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(chainExitERC1155Predicate.target, true)

      oldAccountBalanceA = await dummyMintableERC1155.balanceOf(depositor, tokenIdA)
      oldAccountBalanceB = await dummyMintableERC1155.balanceOf(depositor, tokenIdB)
      oldContractBalanceA = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenIdA)
      oldContractBalanceB = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenIdB)
    })

    it('Depositor should have balance', () => {
      expect(amountA).to.equal(oldAccountBalanceA)
      expect(amountB).to.equal(oldAccountBalanceB)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyMintableERC1155.isApprovedForAll(depositor, chainExitERC1155Predicate.target)
      expect(approved).to.equal(true)
    })

    it('Should be able to receive lockTokens tx', async () => {
      await expect(
        chainExitERC1155Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC1155.target, depositData)
      )
        .to.emit(chainExitERC1155Predicate, 'LockedBatchChainExitERC1155')
        .withArgs(depositor, depositReceiver, dummyMintableERC1155.target, [tokenIdA, tokenIdB], [amountA, amountB])
    })

    // @note Already verified in the above test
    // it('Should emit LockedBatchChainExitERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs);
    //   lockedLog = logs.find(l => l.event === 'LockedBatchChainExitERC1155');
    //   expect(lockedLog).to.exist;
    // });

    // describe('Correct values should be emitted in LockedBatchChainExitERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.target.should.equal(
    //       chainExitERC1155Predicate.target.toLowerCase()
    //     );
    //   });

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor);
    //   });

    //   it('Should emit proper deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver);
    //   });

    //   it('Should emit proper root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyMintableERC1155.target);
    //   });

    //   it('Should emit proper token id for A', () => {
    //     const id = lockedLog.args.ids[0].toNumber();
    //     id.should.equal(tokenIdA);
    //   });

    //   it('Should emit proper token id for B', () => {
    //     const id = lockedLog.args.ids[1].toNumber();
    //     id.should.equal(tokenIdB);
    //   });

    //   it('Should emit proper amount for A', () => {
    //     const amounts = lockedLog.args.amounts;
    //     const amount = new BN(amounts[0].toString());
    //     amount.should.be.a.bignumber.that.equals(amountA);
    //   });

    //   it('Should emit proper amount for B', () => {
    //     const amounts = lockedLog.args.amounts;
    //     const amount = new BN(amounts[1].toString());
    //     amount.should.be.a.bignumber.that.equals(amountB);
    //   });
    // });

    it('Deposit amount should be deducted from depositor account for A', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor, tokenIdA)
      expect(newAccountBalance).to.equal(oldAccountBalanceA - amountA)
    })

    it('Deposit amount should be deducted from depositor account for B', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor, tokenIdB)
      expect(newAccountBalance).to.equal(oldAccountBalanceB - amountB)
    })

    it('Deposit amount should be credited to correct contract for A', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenIdA)
      expect(newContractBalance).to.equal(oldContractBalanceA + amountA)
    })

    it('Deposit amount should be credited to correct contract for B', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenIdB)
      expect(newContractBalance).to.equal(oldContractBalanceB + amountB)
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const amount = mockValues.amounts[9]
    const depositData = constructERC1155DepositData([tokenId], [amount])
    const depositReceiver = accounts[2]
    let depositor
    let dummyMintableERC1155
    let chainExitERC1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      chainExitERC1155Predicate = contracts.chainExitERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, chainExitERC1155Predicate.target)

      await dummyMintableERC1155.mint(depositor, tokenId, amount, '0x')
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(chainExitERC1155Predicate.target, true)
    })

    it('Should revert with correct reason', async () => {
      await expect(
        chainExitERC1155Predicate
          .connect(depositor)
          .lockTokens(depositor, depositReceiver, dummyMintableERC1155.target, depositData)
      ).to.be.revertedWith('ChainExitERC1155Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const amount = mockValues.amounts[9]
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [amount])
    const withdrawer = mockValues.addresses[8]
    let depositor
    let dummyMintableERC1155
    let chainExitERC1155Predicate
    let exitTokensTx
    let oldAccountBalance
    let oldContractBalance

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      chainExitERC1155Predicate = contracts.chainExitERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, chainExitERC1155Predicate.target)

      await dummyMintableERC1155.mint(depositor, tokenId, amount, '0x')
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(chainExitERC1155Predicate.target, true)

      await chainExitERC1155Predicate.lockTokens(
        depositor,
        mockValues.addresses[2],
        dummyMintableERC1155.target,
        depositData
      )
      oldAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId)
      oldContractBalance = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenId)
    })

    it('Predicate should have the token', async () => {
      expect(oldContractBalance).to.equal(amount)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155ChainExitLog({
        to: withdrawer,
        tokenIds: [tokenId],
        amounts: [amount],
        data: 'Hello 👋'
      })

      exitTokensTx = await chainExitERC1155Predicate.exitTokens(
        dummyMintableERC1155.target,
        dummyMintableERC1155.target,
        burnLog
      )
      expect(exitTokensTx).to.exist
    })

    it('Withdraw amount should be deducted from contract', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(chainExitERC1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(oldContractBalance - amount)
    })

    it('Withdraw amount should be credited to withdrawer', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId)
      expect(newAccountBalance).to.equal(oldAccountBalance + amount)
    })
  })

  describe('exitTokens with real burn log', () => {
    const amount = mockValues.amounts[9]
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [amount])
    let depositor

    let dummyMintableERC1155
    let chainExitERC1155Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      chainExitERC1155Predicate = contracts.chainExitERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, chainExitERC1155Predicate.target)

      await dummyMintableERC1155.mint(depositor, tokenId, amount, '0x')
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(chainExitERC1155Predicate.target, true)

      await chainExitERC1155Predicate.lockTokens(
        depositor,
        mockValues.addresses[2],
        dummyMintableERC1155.target,
        depositData
      )
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155ChainExitLog({
        to: mockValues.zeroAddress,
        tokenIds: [tokenId],
        amounts: [amount],
        data: 'Hello 👋'
      })
      await expect(
        chainExitERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.be.revertedWith('ChainExitERC1155Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens with unsupported burn log', () => {
    const amount = mockValues.amounts[9]
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [amount])
    const withdrawer = mockValues.addresses[8]

    let depositor
    let dummyMintableERC1155
    let chainExitERC1155Predicate

    before(async () => {
      const depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyMintableERC1155 = contracts.dummyMintableERC1155
      chainExitERC1155Predicate = contracts.chainExitERC1155Predicate

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE()
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, chainExitERC1155Predicate.target)

      await dummyMintableERC1155.mint(depositor, tokenId, amount, '0x')
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(chainExitERC1155Predicate.target, true)

      await chainExitERC1155Predicate.lockTokens(
        depositor,
        mockValues.addresses[2],
        dummyMintableERC1155.target,
        depositData
      )
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155ChainExitLog({
        overrideSig: mockValues.bytes32[2],
        to: withdrawer,
        tokenIds: [tokenId],
        amounts: [amount],
        data: 'Hello 👋'
      })
      await expect(
        chainExitERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.be.revertedWith('ChainExitERC1155Predicate: INVALID_WITHDRAW_SIG')
    })
  })
})
