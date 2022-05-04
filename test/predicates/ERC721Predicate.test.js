import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC721TransferLog, getERC721WithdrawnBatchLog, getERC721TransferWithMetadataLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const abi = new AbiCoder()

contract('ERC721Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenId = mockValues.numbers[2]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let dummyERC721
    let erc721Predicate
    let lockTokensTx
    let lockedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId, { from: depositor })
      await dummyERC721.approve(erc721Predicate.address, tokenId, { from: depositor })
    })

    it('Depositor should have token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(depositor)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyERC721.getApproved(tokenId)
      approved.should.equal(erc721Predicate.address)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [tokenId])
      lockTokensTx = await erc721Predicate.lockTokens(depositor, depositReceiver, dummyERC721.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedERC721 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC721')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit correct tokenId', () => {
        const lockedLogTokenId = lockedLog.args.tokenId.toNumber()
        lockedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })

      it('Should emit correct root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('token should be transferred to correct contract', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(erc721Predicate.address)
    })
  })

  describe('batch lockTokens', () => {
    const tokenId1 = mockValues.numbers[2]
    const tokenId2 = mockValues.numbers[6]
    const tokenId3 = mockValues.numbers[9]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let dummyERC721
    let erc721Predicate
    let lockTokensTx
    let lockedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId1, { from: depositor })
      await dummyERC721.mint(tokenId2, { from: depositor })
      await dummyERC721.mint(tokenId3, { from: depositor })
      await dummyERC721.setApprovalForAll(erc721Predicate.address, true, { from: depositor })
    })

    it('Depositor should have token', async () => {
      {
        const owner = await dummyERC721.ownerOf(tokenId1)
        owner.should.equal(depositor)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId2)
        owner.should.equal(depositor)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId3)
        owner.should.equal(depositor)
      }
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyERC721.isApprovedForAll(depositor, erc721Predicate.address)
      approved.should.equal(true)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(
        ['uint256[]'],
        [
          [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]
        ]
      )
      lockTokensTx = await erc721Predicate.lockTokens(depositor, depositReceiver, dummyERC721.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedERC721Batch log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC721Batch')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC721Batch log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(depositor)
      })

      it('Should emit correct tokenIds', () => {
        const lockedLogTokenIds = lockedLog.args.tokenIds.map(t => t.toNumber())
        lockedLogTokenIds.should.include(tokenId1)
        lockedLogTokenIds.should.include(tokenId2)
        lockedLogTokenIds.should.include(tokenId3)
      })

      it('Should emit correct deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositReceiver)
      })

      it('Should emit correct root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('token should be transferred to correct contract', async () => {
      {
        const owner = await dummyERC721.ownerOf(tokenId1)
        owner.should.equal(erc721Predicate.address)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId2)
        owner.should.equal(erc721Predicate.address)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId3)
        owner.should.equal(erc721Predicate.address)
      }
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const depositor = accounts[1]
    const depositReceiver = accounts[2]
    const depositData = abi.encode(['uint256'], [tokenId.toString()])
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId, { from: depositor })
      await dummyERC721.approve(erc721Predicate.address, tokenId, { from: depositor })
    })

    it('Should revert with correct reason', async () => {
      await expectRevert(
        erc721Predicate.lockTokens(depositor, depositReceiver, dummyERC721.address, depositData, { from: depositor }),
        'ERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate
    let exitTokensTx
    let exitedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Predicate should have the token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(erc721Predicate.address)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      exitTokensTx = await erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC721')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(withdrawer)
    })
  })

  describe('exitTokens failing with WithdrawnBatch, while passing with Transfer', () => {
    const tokenIdA = mockValues.numbers[5]
    const tokenIdB = mockValues.numbers[6]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate
    let exitTokensTxA
    let exitTokensTxB

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)

      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      await dummyERC721.mint(tokenIdA)
      await dummyERC721.mint(tokenIdB)

      await dummyERC721.setApprovalForAll(erc721Predicate.address, true);

      const depositData = abi.encode(
        ['uint256[]'],
        [
          [tokenIdA.toString(), tokenIdB.toString()]
        ]
      )
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Predicate should have both tokens', async () => {
      const ownerA = await dummyERC721.ownerOf(tokenIdA)
      ownerA.should.equal(erc721Predicate.address)

      const ownerB = await dummyERC721.ownerOf(tokenIdB)
      ownerB.should.equal(erc721Predicate.address)
    })

    it('exitTokens should revert with WithdrawnBatch event', async () => {
      const burnLog = getERC721WithdrawnBatchLog({ user: withdrawer, tokenIds: [tokenIdA, tokenIdB] });
      await expectRevert(erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog), 'ERC721Predicate: INVALID_SIGNATURE')
    })

    it('exitTokens should pass with Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId: tokenIdA })
      exitTokensTxA = await erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog)
      should.exist(exitTokensTxA)
    })

    it('tokenIdA should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenIdA)
      owner.should.equal(withdrawer)
    })

    it('exitTokens should pass with another Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId: tokenIdB })
      exitTokensTxB = await erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog)
      should.exist(exitTokensTxB)
    })

    it('tokenIdB should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenIdB)
      owner.should.equal(withdrawer)
    })
  })

  describe('exitTokens failing with TransferWithMetadata, while passing with Transfer', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    const metaData = 'https://nft.matic.network'

    let dummyERC721
    let erc721Predicate
    let exitTokensTx
    let exitedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate

      const PREDICATE_ROLE = await dummyERC721.PREDICATE_ROLE()
      await dummyERC721.grantRole(PREDICATE_ROLE, erc721Predicate.address)

      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Predicate should have the token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(erc721Predicate.address)
    })

    it('exitTokens should revert with TransferWithMetadata event', async () => {
      const burnLog = getERC721TransferWithMetadataLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        metaData
      })

      await expectRevert(erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog), 'ERC721Predicate: INVALID_SIGNATURE')
    })

    it('exitTokens should pass with Transfer event', async () => {
      const burnLog = getERC721TransferLog({ from: withdrawer, to: mockValues.zeroAddress, tokenId: tokenId })
      exitTokensTx = await erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC721')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(withdrawer)
    })
  })

  describe('exitTokens called by different user', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[3]
    let dummyERC721
    let erc721Predicate
    let exitTokensTx
    let exitedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Should be able to receive exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      })
      exitTokensTx = await erc721Predicate.exitTokens(exitCaller, dummyERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedERC721')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('Token should be transferred to withdrawer', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.should.equal(withdrawer)
    })
  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      })
      await expectRevert(erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog), 'ERC721Predicate: INVALID_SIGNATURE')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })
      await expectRevert(erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog), 'ERC721Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyERC721
    let erc721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      erc721Predicate = contracts.erc721Predicate
      await dummyERC721.mint(tokenId)
      await dummyERC721.approve(erc721Predicate.address, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId])
      await erc721Predicate.lockTokens(accounts[0], withdrawer, dummyERC721.address, depositData)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })
      await expectRevert(
        erc721Predicate.exitTokens(withdrawer, dummyERC721.address, burnLog, { from: accounts[2] }),
        'ERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
