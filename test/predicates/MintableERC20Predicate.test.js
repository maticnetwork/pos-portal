import { AbiCoder } from 'ethers';
import { deployFreshRootContracts } from '../helpers/deployerNew.js';
import { expect } from 'chai';
import { getERC20TransferLog } from '../helpers/logs.js';
import { mockValues } from '../helpers/constants.js';

const abi = new AbiCoder();

contract('MintableERC20Predicate', (accounts) => {
  describe('lockTokens', () => {
    const depositAmount = mockValues.amounts[4];
    const depositReceiver = mockValues.addresses[7];
    let depositor;

    let dummyMintableERC20;
    let mintableERC20Predicate;
    let oldAccountBalance;
    let oldContractBalance;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE()
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target)

      const burnLog = getERC20TransferLog({
        from: depositor.address,
        to: mockValues.zeroAddress,
        amount: depositAmount
      })
      // because it's a mintable ERC20, we're first going to exit it and
      // predicate will mint that much amount for us and send it back
      // to `depositor`, which is going to be approved to predicate, so that
      // it can get it transferred to itself
      await mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      await dummyMintableERC20.connect(depositor).approve(mintableERC20Predicate.target, depositAmount)

      oldAccountBalance = await dummyMintableERC20.balanceOf(depositor)
      oldContractBalance = await dummyMintableERC20.balanceOf(mintableERC20Predicate.target)
    })

    it('Depositor should have proper balance', () => {
      expect(oldAccountBalance).to.be.at.least(depositAmount);
    })

    it('Depositor should have approved proper amount', async () => {
      const allowance = await dummyMintableERC20.allowance(depositor.address, mintableERC20Predicate.target);
      expect(allowance).to.equal(depositAmount);
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()]);
      await expect(
        mintableERC20Predicate.lockTokens(depositor.address, depositReceiver, dummyMintableERC20.target, depositData)
      ).to.emit(mintableERC20Predicate, 'LockedMintableERC20')
        .withArgs(depositor.address, depositReceiver, dummyMintableERC20.target, depositAmount);
    })

    // @note Already verified in the above test
    // it('Should emit LockedMintableERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedMintableERC20')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedMintableERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       mintableERC20Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyMintableERC20.address)
    //   })

    //   it('Should emit correct amount', () => {
    //     const lockedLogAmount = new BN(lockedLog.args.amount.toString())
    //     lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyMintableERC20.balanceOf(depositor.address);
      expect(newAccountBalance).to.equal(oldAccountBalance - depositAmount);
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyMintableERC20.balanceOf(mintableERC20Predicate.target);
      expect(newContractBalance).to.equal(oldContractBalance + depositAmount);
    })
  })

  describe('lockTokens called by non manager', () => {
    const depositAmount = mockValues.amounts[3];
    const depositReceiver = accounts[2];

    let depositor;
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);

      const burnLog = getERC20TransferLog({
        from: depositor.address,
        to: mockValues.zeroAddress,
        amount: depositAmount
      })
      await mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog);
      await dummyMintableERC20.connect(depositor).approve(mintableERC20Predicate.target, depositAmount);
    })

    it('Should revert with correct reason', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()]);
      await expect(
        mintableERC20Predicate.connect(depositor).lockTokens(depositor.address, depositReceiver, dummyMintableERC20.target, depositData)
      ).to.be.revertedWith('MintableERC20Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })

  describe('exitTokens by Alice then deposit back and exitTokens for second time by Bob', () => {
    const amount = mockValues.amounts[2];
    const bob = mockValues.addresses[8];

    let alice;
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      alice = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);
    })

    it('Predicate should have 0 balance', async () => {
      expect(await dummyMintableERC20.balanceOf(mintableERC20Predicate.target)).to.equal(0);
    })

    it('Alice should be able to send exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: alice.address,
        to: mockValues.zeroAddress,
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.emit(mintableERC20Predicate, 'ExitedMintableERC20')
        .withArgs(alice.address, dummyMintableERC20.target, amount);
    })

    it('Amount should be minted for Alice', async () => {
      expect(await dummyMintableERC20.balanceOf(alice.address)).to.equal(amount);
    })

    it('Alice should be able to deposit amount back', async () => {
      await dummyMintableERC20.connect(alice).approve(mintableERC20Predicate.target, amount);
      const depositData = abi.encode(['uint256'], [amount.toString()]);
      await expect(
        mintableERC20Predicate.lockTokens(alice.address, alice.address, dummyMintableERC20.target, depositData)
      ).to.emit(mintableERC20Predicate, 'LockedMintableERC20')
        .withArgs(alice.address, alice.address, dummyMintableERC20.target, amount);
    })

    it('Amount should be transfered to mintableERC20Predicate', async () => {
      expect(await dummyMintableERC20.balanceOf(mintableERC20Predicate.target)).to.equal(amount);
    })

    it('Bob should be able to send exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.emit(mintableERC20Predicate, 'ExitedMintableERC20')
        .withArgs(bob, dummyMintableERC20.target, amount);
    })

    it('Amount should be transfered to Bob', async () => {
      expect(await dummyMintableERC20.balanceOf(bob)).to.equal(amount);
    })
  })

  describe('exitTokens called by different user', () => {
    const amount = mockValues.amounts[2];
    const bob = mockValues.addresses[8];

    let alice;
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      alice = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: alice.address,
        to: mockValues.zeroAddress,
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.emit(mintableERC20Predicate, 'ExitedMintableERC20')
        .withArgs(alice.address, dummyMintableERC20.target, amount);
    })

    it('Amount should be minted for alice', async () => {
      expect(await dummyMintableERC20.balanceOf(alice.address)).to.equal(amount);
    })

    it('Alice should be able to deposit token back', async () => {
      await dummyMintableERC20.connect(alice).approve(mintableERC20Predicate.target, amount);
      const depositData = abi.encode(['uint256'], [amount.toString()]);
      await expect(
        mintableERC20Predicate.lockTokens(alice.address, alice.address, dummyMintableERC20.target, depositData)
      ).to.emit(mintableERC20Predicate, 'LockedMintableERC20')
        .withArgs(alice.address, alice.address, dummyMintableERC20.target, amount);
    })

    it('Amount should be transfered to mintableERC20Predicate', async () => {
      expect(await dummyMintableERC20.balanceOf(mintableERC20Predicate.target)).to.equal(amount);
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC20TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.emit(mintableERC20Predicate, 'ExitedMintableERC20')
        .withArgs(bob, dummyMintableERC20.target, amount);
    })

    // @note Already verified in the above test
    // it('Should emit ExitedMintableERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedMintableERC20')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC20Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(bob)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC20.address)
    //   })

    //   it('Should emit correct amount', () => {
    //     const exitedLogAmount = new BN(exitedLog.args.amount.toString())
    //     exitedLogAmount.should.be.bignumber.that.equals(amount)
    //   })
    // })

    it('Token should be transfered to bob', async () => {
      expect(await dummyMintableERC20.balanceOf(bob)).to.equal(amount);
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const amount = mockValues.amounts[2];
    const withdrawer = mockValues.addresses[8];
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.be.revertedWith('MintableERC20Predicate: INVALID_SIGNATURE');
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const amount = mockValues.amounts[2];
    const withdrawer = mockValues.addresses[8];
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: amount
      });
      await expect(
        mintableERC20Predicate.exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.be.revertedWith('MintableERC20Predicate: INVALID_RECEIVER');
    })
  })

  describe('exitTokens called by non manager', () => {
    const amount = mockValues.amounts[2];
    const withdrawer = mockValues.addresses[8];
    let nonManager;
    let dummyMintableERC20;
    let mintableERC20Predicate;

    before(async () => {
      nonManager = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC20 = contracts.dummyMintableERC20;
      mintableERC20Predicate = contracts.mintableERC20Predicate;

      const PREDICATE_ROLE = await dummyMintableERC20.PREDICATE_ROLE();
      await dummyMintableERC20.grantRole(PREDICATE_ROLE, mintableERC20Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC20TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        amount: amount
      });
      await expect(
        mintableERC20Predicate.connect(nonManager).exitTokens(dummyMintableERC20.target, dummyMintableERC20.target, burnLog)
      ).to.be.revertedWith('MintableERC20Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })
})
