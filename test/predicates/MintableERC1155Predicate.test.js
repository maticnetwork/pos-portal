import { AbiCoder } from 'ethers';
import { deployFreshRootContracts } from '../helpers/deployerNew.js';
import { expect } from 'chai';
import { mockValues } from '../helpers/constants.js';
import { getERC1155TransferSingleLog, getERC1155TransferBatchLog } from '../helpers/logs.js';
import { constructERC1155DepositData } from '../helpers/utils.js';

const abi = new AbiCoder();

contract('MintableERC1155Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenIdA = mockValues.numbers[2];
    const tokenIdB = mockValues.numbers[7];
    const amountA = mockValues.amounts[0];
    const amountB = mockValues.amounts[1];
    const depositReceiver = mockValues.addresses[7];
    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;
    let oldAccountBalanceA;
    let oldAccountBalanceB;
    let oldContractBalanceA;
    let oldContractBalanceB;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [amountA, amountB]
      });

      // because it's a mintable token, burning it first then
      // brining it to root chain by making predicate contract mint it for us
      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      oldAccountBalanceA = await dummyMintableERC1155.balanceOf(depositor.address, tokenIdA);
      oldAccountBalanceB = await dummyMintableERC1155.balanceOf(depositor.address, tokenIdB);
      oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
    })

    it('Depositor should have balance', () => {
      expect(oldAccountBalanceA).to.be.lte(amountA);
      expect(oldAccountBalanceB).to.be.lte(amountB);
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyMintableERC1155.isApprovedForAll(depositor.address, mintableERC1155Predicate.target);
      expect(approved).to.equal(true);
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB]);
      await expect(
        mintableERC1155Predicate.lockTokens(depositor.address, depositReceiver, dummyMintableERC1155.target, depositData)
      ).to.emit(mintableERC1155Predicate, 'LockedBatchMintableERC1155')
        .withArgs(depositor.address, depositReceiver, dummyMintableERC1155.target, [tokenIdA, tokenIdB], [amountA, amountB]);
    })

    // @note Already verified in the above test
    // it('Should emit LockedBatchMintableERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedBatchMintableERC1155')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedBatchMintableERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       mintableERC1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit proper deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })

    //   it('Should emit proper root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor.address, tokenIdA);
      expect(newAccountBalance).to.equal(oldAccountBalanceA - amountA);
    })

    it('Deposit amount should be deducted from depositor account for B', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(depositor.address, tokenIdB);
      expect(newAccountBalance).to.equal(oldAccountBalanceB - amountB);
    })

    it('Deposit amount should be credited to correct contract for A', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      expect(newContractBalance).to.equal(oldContractBalanceA + amountA);
    })

    it('Deposit amount should be credited to correct contract for B', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
      expect(newContractBalance).to.equal(oldContractBalanceB + amountB);
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5];
    const amount = mockValues.amounts[9];
    const depositReceiver = accounts[2];
    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenIds: [tokenId],
        amounts: [amount]
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);
    })

    it('Should revert with correct reason', async () => {
      const depositData = constructERC1155DepositData([tokenId], [amount]);
      await expect(
        mintableERC1155Predicate.connect(depositor).lockTokens(depositor.address, depositReceiver, dummyMintableERC1155.target, depositData)
      ).to.be.revertedWith('MintableERC1155Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })

  describe('exitTokens single', () => {
    const amount = mockValues.amounts[9];
    const exitAmount = amount / 2n;
    const tokenId = mockValues.numbers[4];
    const withdrawer = mockValues.addresses[8];
    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;
    let oldAccountBalance;
    let oldContractBalance;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      // Force predicate to `mint`
      const burnLog = getERC1155TransferSingleLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenId,
        amount
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      const depositData = constructERC1155DepositData([tokenId], [amount]);
      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);

      oldAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId);
      oldContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenId);
    })

    it('Predicate should have the token', async () => {
      expect(oldContractBalance).to.be.at.gte(exitAmount);
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        amount: exitAmount
      });
      await expect(
        mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.emit(mintableERC1155Predicate, 'ExitedMintableERC1155')
        .withArgs(withdrawer, dummyMintableERC1155.target, tokenId, exitAmount);
    })

    // @note Already verified in the above test
    // it('Should emit ExitedMintableERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedMintableERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
    //   })

    //   it('Should emit proper token id', () => {
    //     const exitedLogTokenId = exitedLog.args.id.toNumber()
    //     exitedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit proper token amount', () => {
    //     const exitedLogAmount = new BN(exitedLog.args.amount.toString())
    //     exitedLogAmount.should.be.a.bignumber.that.equals(exitAmount)
    //   })
    // })

    it('Withdaw amount should be deducted from contract', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenId);
      expect(newContractBalance).to.equal(oldContractBalance - exitAmount);
    })

    it('Withdraw amount should be credited to withdrawer', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenId);
      expect(newAccountBalance).to.equal(oldAccountBalance + exitAmount);
    })
  })

  describe('exitTokens batch', () => {
    const amountA = mockValues.amounts[9];
    const amountB = mockValues.amounts[8];
    const burnAmountA = amountA / 2n;
    const burnAmountB = amountB / 2n;

    const tokenIdA = mockValues.numbers[4];
    const tokenIdB = mockValues.numbers[5];

    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB]);
    const withdrawer = mockValues.addresses[8];

    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;
    let oldAccountBalanceA;
    let oldAccountBalanceB;
    let oldContractBalanceA;
    let oldContractBalanceB;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [amountA, amountB]
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);

      oldAccountBalanceA = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA);
      oldAccountBalanceB = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB);

      oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
    })

    it('Predicate should have the token balances', async () => {
      expect(oldContractBalanceA).to.be.gte(burnAmountA);
      expect(oldContractBalanceB).to.be.gte(burnAmountB);
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [burnAmountA, burnAmountB]
      });
      await expect(
        mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.emit(mintableERC1155Predicate, 'ExitedBatchMintableERC1155')
        .withArgs(
          withdrawer,
          dummyMintableERC1155.target,
          [tokenIdA, tokenIdB],
          [burnAmountA, burnAmountB]
        );
    })

    // @note Already verified in the above test
    // it('Should emit ExitedBatchMintableERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedBatchMintableERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedBatchMintableERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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
    //     amount.should.be.a.bignumber.that.equals(burnAmountA)
    //   })

    //   it('Should emit proper amount for B', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[1].toString())
    //     amount.should.be.a.bignumber.that.equals(burnAmountB)
    //   })
    // })

    it('Withdraw amount should be deducted from contract for A', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      expect(newContractBalance).to.equal(oldContractBalanceA - burnAmountA);
    });

    it('Withdraw amount should be deducted from contract for B', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
      expect(newContractBalance).to.equal(oldContractBalanceB - burnAmountB);
    });

    it('Withdraw amount should be credited to withdrawer for A', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA);
      expect(newAccountBalance).to.equal(oldAccountBalanceA + burnAmountA);
    });

    it('Withdraw amount should be credited to withdrawer for B', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB);
      expect(newAccountBalance).to.equal(oldAccountBalanceB + burnAmountB);
    });
  })

  describe('exitTokens called by different user', () => {
    const amountA = mockValues.amounts[9];
    const amountB = mockValues.amounts[8];

    const tokenIdA = mockValues.numbers[4];
    const tokenIdB = mockValues.numbers[5];

    const depositData = constructERC1155DepositData([tokenIdA, tokenIdB], [amountA, amountB]);
    const withdrawer = mockValues.addresses[8];

    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;
    let oldAccountBalanceA;
    let oldAccountBalanceB;
    let oldContractBalanceA;
    let oldContractBalanceB;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [amountA, amountB]
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);

      oldAccountBalanceA = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA);
      oldAccountBalanceB = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB);

      oldContractBalanceA = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      oldContractBalanceB = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC1155TransferBatchLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenIds: [tokenIdA, tokenIdB],
        amounts: [amountA, amountB]
      });
      await expect(
        mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.emit(mintableERC1155Predicate, 'ExitedBatchMintableERC1155')
        .withArgs(
          withdrawer,
          dummyMintableERC1155.target,
          [tokenIdA, tokenIdB],
          [amountA, amountB]
        );
    })

    // @note Already verified in the above test
    // it('Should emit ExitedBatchMintableERC1155 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedBatchMintableERC1155')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedBatchMintableERC1155 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC1155Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit proper root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC1155.address)
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
    //     amount.should.be.a.bignumber.that.equals(amountA)
    //   })

    //   it('Should emit proper amount for B', () => {
    //     const amounts = exitedLog.args.amounts
    //     const amount = new BN(amounts[1].toString())
    //     amount.should.be.a.bignumber.that.equals(amountB)
    //   })
    // })

    it('Withdraw amount should be deducted from contract for A', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdA);
      expect(newContractBalance).to.equal(oldContractBalanceA - amountA);
    });

    it('Withdraw amount should be deducted from contract for B', async () => {
      const newContractBalance = await dummyMintableERC1155.balanceOf(mintableERC1155Predicate.target, tokenIdB);
      expect(newContractBalance).to.equal(oldContractBalanceB - amountB);
    });

    it('Withdraw amount should be credited to withdrawer for A', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdA);
      expect(newAccountBalance).to.equal(oldAccountBalanceA + amountA);
    });

    it('Withdraw amount should be credited to withdrawer for B', async () => {
      const newAccountBalance = await dummyMintableERC1155.balanceOf(withdrawer, tokenIdB);
      expect(newAccountBalance).to.equal(oldAccountBalanceB + amountB);
    });
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const amount = mockValues.amounts[9];
    const tokenId = mockValues.numbers[4];
    const withdrawer = mockValues.addresses[8];

    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferSingleLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenId,
        amount
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      const depositData = constructERC1155DepositData([tokenId], [amount]);
      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        overrideSig: mockValues.bytes32[2],
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        amount
      });
      await expect(
        mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.be.revertedWith('MintableERC1155Predicate: INVALID_WITHDRAW_SIG');
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const amount = mockValues.amounts[9];
    const tokenId = mockValues.numbers[4];
    const withdrawer = mockValues.addresses[8];

    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferBatchLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenIds: [tokenId],
        amounts: [amount]
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      const depositData = constructERC1155DepositData([tokenId], [amount]);
      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId,
        amount
      });
      await expect(
        mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.be.revertedWith('MintableERC1155Predicate: INVALID_RECEIVER');
    })
  })

  describe('exitTokens called by non manager', () => {
    const amount = mockValues.amounts[9];
    const tokenId = mockValues.numbers[4];
    const withdrawer = mockValues.addresses[8];

    let depositor;
    let dummyMintableERC1155;
    let mintableERC1155Predicate;
    let nonManager;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      nonManager = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC1155 = contracts.dummyMintableERC1155;
      mintableERC1155Predicate = contracts.mintableERC1155Predicate;

      const PREDICATE_ROLE = await dummyMintableERC1155.PREDICATE_ROLE();
      await dummyMintableERC1155.grantRole(PREDICATE_ROLE, mintableERC1155Predicate.target);

      const burnLog = getERC1155TransferSingleLog({
        operator: depositor.address,
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenId,
        amount
      });

      await mintableERC1155Predicate.exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog);
      await dummyMintableERC1155.connect(depositor).setApprovalForAll(mintableERC1155Predicate.target, true);

      const depositData = constructERC1155DepositData([tokenId], [amount]);
      await mintableERC1155Predicate.lockTokens(depositor.address, mockValues.addresses[2], dummyMintableERC1155.target, depositData);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC1155TransferSingleLog({
        operator: withdrawer,
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        amount
      });
      await expect(
        mintableERC1155Predicate.connect(nonManager).exitTokens(dummyMintableERC1155.target, dummyMintableERC1155.target, burnLog)
      ).to.be.revertedWith('MintableERC1155Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })
})
