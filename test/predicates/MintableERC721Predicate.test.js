import { AbiCoder } from 'ethers';
import { deployFreshRootContracts } from '../helpers/deployerNew.js';
import { expect } from 'chai';
import { getERC721TransferLog, getERC721TransferWithMetadataLog } from '../helpers/logs.js';
import { mockValues } from '../helpers/constants.js';

const abi = new AbiCoder();

contract('MintableERC721Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenId = mockValues.numbers[2];
    const depositReceiver = mockValues.addresses[7];
    let depositor;
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;

      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);

      // tokens cannot be minted on main chain so they need to be withdrawn before depositing
      const burnLog = getERC721TransferLog({
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog);
      await dummyMintableERC721.connect(depositor).approve(mintableERC721Predicate.target, tokenId);
    })

    it('Depositor should have token', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(depositor.address);
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyMintableERC721.getApproved(tokenId);
      expect(approved).to.equal(mintableERC721Predicate.target);
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [tokenId]);
      await expect(
        mintableERC721Predicate.lockTokens(depositor.address, depositReceiver, dummyMintableERC721.target, depositData)
      ).to.emit(mintableERC721Predicate, 'LockedMintableERC721')
        .withArgs(depositor.address, depositReceiver, dummyMintableERC721.target, tokenId);
    })

    // @note Already verified in the test above
    // it('Should emit LockedMintableERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedMintableERC721')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedMintableERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       mintableERC721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const lockedLogTokenId = lockedLog.args.tokenId.toNumber()
    //     lockedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyMintableERC721.address)
    //   })
    // })

    it('token should be transferred to correct contract', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(mintableERC721Predicate.target);
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5];
    const depositReceiver = accounts[2];
    let depositor;
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      depositor = await ethers.getSigner(accounts[1]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;

      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);

      // tokens cannot be minted on main chain so they need to be withdrawn before depositing
      const burnLog = getERC721TransferLog({
        from: depositor.address,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog);
      await dummyMintableERC721.connect(depositor).approve(mintableERC721Predicate.target, tokenId);
    })

    it('Should revert with correct reason', async () => {
      const depositData = abi.encode(['uint256'], [tokenId]);
      await expect(
        mintableERC721Predicate.connect(depositor).lockTokens(depositor.address, depositReceiver, dummyMintableERC721.target, depositData)
      ).to.be.revertedWith('MintableERC721Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })

  describe('exitTokens by alice then deposit back and exitTokens for second time by bob', () => {
    const tokenId = mockValues.numbers[5];
    const bob = mockValues.addresses[8];

    let alice;
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      alice = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('Token should not exist', async () => {
      await expect(dummyMintableERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    })

    it('alice should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: alice.address,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.emit(mintableERC721Predicate, 'ExitedMintableERC721')
        .withArgs(alice.address, dummyMintableERC721.target, tokenId);
    })

    // @note Already verified in the test above
    // it('Should emit ExitedMintableERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedMintableERC721')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(alice)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
    //     exitedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC721.address)
    //   })
    // })

    it('Token should be minted for alice', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(alice.address);
    })

    it('alice should be able to deposit token back', async () => {
      await dummyMintableERC721.connect(alice).approve(mintableERC721Predicate.target, tokenId);
      const depositData = abi.encode(['uint256'], [tokenId]);
      await expect(
        mintableERC721Predicate.lockTokens(alice.address, alice.address, dummyMintableERC721.target, depositData)
      ).to.emit(mintableERC721Predicate, 'LockedMintableERC721')
        .withArgs(alice.address, alice.address, dummyMintableERC721.target, tokenId);
    })

    it('Token should be transfered to mintableERC721Predicate', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(mintableERC721Predicate.target);
    })

    it('bob should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.emit(mintableERC721Predicate, 'ExitedMintableERC721')
        .withArgs(bob, dummyMintableERC721.target, tokenId);
    })

    it('Token should be transfered to bob', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(bob);
    })
  })

  describe('exitTokens called by different user', () => {
    const tokenId = mockValues.numbers[5];
    const bob = mockValues.addresses[8];

    let alice;
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      alice = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: alice.address,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.emit(mintableERC721Predicate, 'ExitedMintableERC721')
        .withArgs(alice.address, dummyMintableERC721.target, tokenId);
    })

    // @note Already verified in the test above
    // it('Should emit ExitedMintableERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog0 = logs.find(l => l.event === 'ExitedMintableERC721')
    //   should.exist(exitedLog0)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog0.address.should.equal(
    //       mintableERC721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog0.args.exitor.should.equal(alice)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const exitedLogTokenId = exitedLog0.args.tokenId.toNumber()
    //     exitedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog0.args.rootToken.should.equal(dummyMintableERC721.address)
    //   })
    // })

    it('Token should be minted for alice', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(alice.address);
    })

    it('alice should be able to deposit token back', async () => {
      await dummyMintableERC721.connect(alice).approve(mintableERC721Predicate.target, tokenId);
      const depositData = abi.encode(['uint256'], [tokenId]);
      await expect(
        mintableERC721Predicate.lockTokens(alice.address, alice.address, dummyMintableERC721.target, depositData)
      ).to.emit(mintableERC721Predicate, 'LockedMintableERC721')
        .withArgs(alice.address, alice.address, dummyMintableERC721.target, tokenId);
    })

    it('Token should be transfered to mintableERC721Predicate', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(mintableERC721Predicate.target);
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.emit(mintableERC721Predicate, 'ExitedMintableERC721')
        .withArgs(bob, dummyMintableERC721.target, tokenId);
    })

    // @note Already verified in the test above
    // it('Should emit ExitedMintableERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog1 = logs.find(l => l.event === 'ExitedMintableERC721')
    //   should.exist(exitedLog1)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog1.address.should.equal(
    //       mintableERC721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog1.args.exitor.should.equal(bob)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const exitedLogTokenId = exitedLog1.args.tokenId.toNumber()
    //     exitedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog1.args.rootToken.should.equal(dummyMintableERC721.address)
    //   })
    // })

    it('Token should be transfered to bob', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(bob);
    })
  })

  describe('exitTokens with `TransferWithMetadata` event signature', () => {
    const tokenId = mockValues.numbers[5];
    const withdrawer = mockValues.addresses[8];
    const metaData = 'https://nft.matic.network';

    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('Transaction should go through', async () => {
      const burnLog = getERC721TransferWithMetadataLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        metaData
      });

      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.emit(mintableERC721Predicate, 'ExitedMintableERC721')
        .withArgs(withdrawer, dummyMintableERC721.target, tokenId);
    })

    // @note Already verified in the test above
    // it('Should emit ExitedMintableERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedMintableERC721')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       mintableERC721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper withdrawer', () => {
    //     exitedLog.args.exitor.should.equal(withdrawer)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
    //     exitedLogTokenId.should.equal(tokenId)
    //   })

    //   it('Should emit correct root token', () => {
    //     exitedLog.args.rootToken.should.equal(dummyMintableERC721.address)
    //   })
    // })

    it('Token should be transfered to withdrawer', async () => {
      expect(await dummyMintableERC721.ownerOf(tokenId)).to.equal(withdrawer);
    })

    it('Token URI should match with transferred metadata', async () => {
      expect(await dummyMintableERC721.tokenURI(tokenId)).to.equal(metaData);
    })

  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const tokenId = mockValues.numbers[5];
    const withdrawer = mockValues.addresses[8];
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.be.revertedWith('MintableERC721Predicate: INVALID_SIGNATURE');
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const tokenId = mockValues.numbers[5];
    const withdrawer = mockValues.addresses[8];
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      });
      await expect(
        mintableERC721Predicate.exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.be.revertedWith('MintableERC721Predicate: INVALID_RECEIVER');
    })
  })

  describe('exitTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5];
    const withdrawer = mockValues.addresses[8];
    let nonManager;
    let dummyMintableERC721;
    let mintableERC721Predicate;

    before(async () => {
      nonManager = await ethers.getSigner(accounts[2]);
      const contracts = await deployFreshRootContracts(accounts);
      dummyMintableERC721 = contracts.dummyMintableERC721;
      mintableERC721Predicate = contracts.mintableERC721Predicate;
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE();
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.target);
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      });
      await expect(
        mintableERC721Predicate.connect(nonManager).exitTokens(dummyMintableERC721.target, dummyMintableERC721.target, burnLog)
      ).to.be.revertedWith('MintableERC721Predicate: INSUFFICIENT_PERMISSIONS');
    })
  })
})
