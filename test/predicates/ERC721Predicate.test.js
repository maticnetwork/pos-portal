import { AbiCoder } from 'ethers'
import { deployFreshRootContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getERC721TransferLog, getERC721WithdrawnBatchLog, getERC721TransferWithMetadataLog } from '../helpers/logs.js'
import { mockValues } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ERC721Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenId = mockValues.numbers[2]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC721
    let erc721Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.connect(depositor).mint(tokenId)
      await dummyERC721.connect(depositor).approve(erc721Predicate.target, tokenId)
    })

    it('Depositor should have token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(depositor.address)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyERC721.getApproved(tokenId)
      expect(approved).to.equal(erc721Predicate.target)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [tokenId])
      await expect(erc721Predicate.lockTokens(depositor.address, depositReceiver, dummyERC721.target, depositData))
        .to.emit(erc721Predicate, 'LockedERC721')
        .withArgs(depositor.address, depositReceiver, dummyERC721.target, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit LockedERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedERC721')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       erc721Predicate.address.toLowerCase()
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
    //     lockedLog.args.rootToken.should.equal(dummyERC721.address)
    //   })
    // })

    it('token should be transferred to correct contract', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(erc721Predicate.target)
    })
  })

  describe('batch lockTokens', () => {
    const tokenId1 = mockValues.numbers[2]
    const tokenId2 = mockValues.numbers[6]
    const tokenId3 = mockValues.numbers[9]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC721
    let erc721Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.connect(depositor).mint(tokenId1)
      await dummyERC721.connect(depositor).mint(tokenId2)
      await dummyERC721.connect(depositor).mint(tokenId3)
      await dummyERC721.connect(depositor).setApprovalForAll(erc721Predicate.target, true)
    })

    it('Depositor should have tokens', async () => {
      const owner1 = await dummyERC721.ownerOf(tokenId1)
      const owner2 = await dummyERC721.ownerOf(tokenId2)
      const owner3 = await dummyERC721.ownerOf(tokenId3)

      expect(owner1).to.equal(depositor.address)
      expect(owner2).to.equal(depositor.address)
      expect(owner3).to.equal(depositor.address)
    })

    it('Depositor should have approved token transfers', async () => {
      const approved = await dummyERC721.isApprovedForAll(depositor.address, erc721Predicate.target)
      expect(approved).to.be.true
    })

    it('Should be able to receive batch lockTokens tx', async () => {
      const depositData = abi.encode(['uint256[]'], [[tokenId1, tokenId2, tokenId3]])
      await expect(erc721Predicate.lockTokens(depositor.address, depositReceiver, dummyERC721.target, depositData))
        .to.emit(erc721Predicate, 'LockedERC721Batch')
        .withArgs(depositor.address, depositReceiver, dummyERC721.target, [tokenId1, tokenId2, tokenId3])
    })

    // @note Already verified in the above test
    // it('Should emit LockedERC721Batch log', () => {
    //   const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedERC721Batch')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedERC721Batch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.address.should.equal(
    //       erc721Predicate.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.should.equal(depositor)
    //   })

    //   it('Should emit correct tokenIds', () => {
    //     const lockedLogTokenIds = lockedLog.args.tokenIds.map(t => t.toNumber())
    //     lockedLogTokenIds.should.include(tokenId1)
    //     lockedLogTokenIds.should.include(tokenId2)
    //     lockedLogTokenIds.should.include(tokenId3)
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyERC721.address)
    //   })
    // })

    it('Tokens should be transferred to the correct contract', async () => {
      const owner1 = await dummyERC721.ownerOf(tokenId1)
      const owner2 = await dummyERC721.ownerOf(tokenId2)
      const owner3 = await dummyERC721.ownerOf(tokenId3)

      expect(owner1).to.equal(erc721Predicate.target)
      expect(owner2).to.equal(erc721Predicate.target)
      expect(owner3).to.equal(erc721Predicate.target)
    })
  })

  describe('lockTokens called by non-manager', () => {
    const tokenId = mockValues.numbers[5]
    const depositReceiver = mockValues.addresses[7]
    let depositor
    let dummyERC721
    let erc721Predicate

    before(async () => {
      depositor = await ethers.getSigner(accounts[1])

      const contracts = await deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.connect(depositor).mint(tokenId)
      await dummyERC721.connect(depositor).approve(erc721Predicate.target, tokenId)
    })

    it('Should revert with correct reason', async () => {
      const depositData = abi.encode(['uint256'], [tokenId])
      await expect(
        erc721Predicate
          .connect(depositor)
          .lockTokens(depositor.address, depositReceiver, dummyERC721.target, depositData)
      ).to.be.revertedWith('ERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Predicate should have the token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(erc721Predicate.target)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      })

      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog))
        .to.emit(erc721Predicate, 'ExitedERC721')
        .withArgs(withdrawer, dummyERC721.target, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC721')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc721Predicate.address.toLowerCase()
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
    //     exitedLog.args.rootToken.should.equal(dummyERC721.address)
    //   })
    // })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(withdrawer)
    })
  })

  describe('exitTokens failing with WithdrawnBatch, while passing with Transfer', () => {
    const tokenIdA = mockValues.numbers[5]
    const tokenIdB = mockValues.numbers[6]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenIdA)
      await dummyERC721.mint(tokenIdB)

      await dummyERC721.setApprovalForAll(erc721Predicate.target, true)

      const depositData = abi.encode(['uint256[]'], [[tokenIdA, tokenIdB]])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Predicate should have both tokens', async () => {
      const ownerA = await dummyERC721.ownerOf(tokenIdA)
      const ownerB = await dummyERC721.ownerOf(tokenIdB)

      expect(ownerA).to.equal(erc721Predicate.target)
      expect(ownerB).to.equal(erc721Predicate.target)
    })

    it('exitTokens should revert with WithdrawnBatch event', async () => {
      const burnLog = getERC721WithdrawnBatchLog({ user: withdrawer, tokenIds: [tokenIdA, tokenIdB] })
      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog)).to.be.revertedWith(
        'ERC721Predicate: INVALID_SIGNATURE'
      )
    })

    it('exitTokens should pass with Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId: tokenIdA })
      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog))
        .to.emit(erc721Predicate, 'ExitedERC721')
        .withArgs(withdrawer, dummyERC721.target, tokenIdA)
    })

    it('tokenIdA should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenIdA)
      expect(owner).to.equal(withdrawer)
    })

    it('exitTokens should pass with another Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId: tokenIdB })
      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog))
        .to.emit(erc721Predicate, 'ExitedERC721')
        .withArgs(withdrawer, dummyERC721.target, tokenIdB)
    })

    it('tokenIdB should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenIdB)
      expect(owner).to.equal(withdrawer)
    })
  })

  describe('exitTokens failing with TransferWithMetadata, while passing with Transfer', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    const metaData = 'https://nft.matic.network'
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      const PREDICATE_ROLE = await dummyERC721.PREDICATE_ROLE()
      await dummyERC721.grantRole(PREDICATE_ROLE, erc721Predicate.target)

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Predicate should have the token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(erc721Predicate.target)
    })

    it('exitTokens should revert with TransferWithMetadata event', async () => {
      const burnLog = getERC721TransferWithMetadataLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        metaData
      })

      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog)).to.be.revertedWith(
        'ERC721Predicate: INVALID_SIGNATURE'
      )
    })

    it('exitTokens should pass with Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId })
      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog))
        .to.emit(erc721Predicate, 'ExitedERC721')
        .withArgs(withdrawer, dummyERC721.target, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC721')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc721Predicate.address.toLowerCase()
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
    //     exitedLog.args.rootToken.should.equal(dummyERC721.address)
    //   })
    // })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(withdrawer)
    })
  })

  describe('exitTokens called by different user', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      })

      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog))
        .to.emit(erc721Predicate, 'ExitedERC721')
        .withArgs(withdrawer, dummyERC721.target, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit ExitedERC721 log', () => {
    //   const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
    //   exitedLog = logs.find(l => l.event === 'ExitedERC721')
    //   should.exist(exitedLog)
    // })

    // describe('Correct values should be emitted in ExitedERC721 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     exitedLog.address.should.equal(
    //       erc721Predicate.address.toLowerCase()
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
    //     exitedLog.args.rootToken.should.equal(dummyERC721.address)
    //   })
    // })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(withdrawer)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        overrideSig: mockValues.bytes32[2]
      })

      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog)).to.be.revertedWith(
        'ERC721Predicate: INVALID_SIGNATURE'
      )
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })

      await expect(erc721Predicate.exitTokens(dummyERC721.target, dummyERC721.target, burnLog)).to.be.revertedWith(
        'ERC721Predicate: INVALID_RECEIVER'
      )
    })
  })

  describe('exitTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.target, tokenId)

      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.target, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })

      await expect(
        erc721Predicate
          .connect(await ethers.getSigner(accounts[2]))
          .exitTokens(dummyERC721.target, dummyERC721.target, burnLog)
      ).to.be.revertedWith('ERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
