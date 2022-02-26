import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC721TransferLog, getERC721TransferWithMetadataLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const abi = new AbiCoder()

contract('MintableERC721Predicate', (accounts) => {
  describe('lockTokens', () => {
    const tokenId = mockValues.numbers[2]
    const depositReceiver = mockValues.addresses[7]
    const depositor = accounts[1]
    let dummyMintableERC721
    let mintableERC721Predicate
    let lockTokensTx
    let lockedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate

      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)

      // tokens cannot be minted on main chain so they need to be withdrawn before depositing
      const burnLog = getERC721TransferLog({
        from: depositor,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      await mintableERC721Predicate.exitTokens(depositor, dummyMintableERC721.address, burnLog)
      await dummyMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: depositor })
    })

    it('Depositor should have token', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(depositor)
    })

    it('Depositor should have approved token transfer', async () => {
      const approved = await dummyMintableERC721.getApproved(tokenId)
      approved.should.equal(mintableERC721Predicate.address)
    })

    it('Should be able to receive lockTokens tx', async () => {
      const depositData = abi.encode(['uint256'], [tokenId])
      lockTokensTx = await mintableERC721Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC721.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Should emit LockedMintableERC721 log', () => {
      const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedMintableERC721')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedMintableERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          mintableERC721Predicate.address.toLowerCase()
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
        lockedLog.args.rootToken.should.equal(dummyMintableERC721.address)
      })
    })

    it('token should be transferred to correct contract', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(mintableERC721Predicate.address)
    })
  })

  describe('lockTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const depositor = accounts[1]
    const depositReceiver = accounts[2]
    const depositData = abi.encode(['uint256'], [tokenId.toString()])
    let dummyMintableERC721
    let mintableERC721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate

      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)

      // tokens cannot be minted on main chain so they need to be withdrawn before depositing
      const burnLog = getERC721TransferLog({
        from: depositor,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      await mintableERC721Predicate.exitTokens(depositor, dummyMintableERC721.address, burnLog)
      await dummyMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: depositor })
    })

    it('Should revert with correct reason', async () => {
      await expectRevert(
        mintableERC721Predicate.lockTokens(depositor, depositReceiver, dummyMintableERC721.address, depositData, { from: depositor }),
        'MintableERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('exitTokens by alice then deposit back and exitTokens for second time by bob', () => {
    const tokenId = mockValues.numbers[5]
    const alice = accounts[2]
    const bob = mockValues.addresses[8]

    let dummyMintableERC721
    let mintableERC721Predicate
    let exitTokensTx
    let exitedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('Token should not exist', async () => {
      await expectRevert(dummyMintableERC721.ownerOf(tokenId), 'revert ERC721: owner query for nonexistent token')
    })

    it('alice should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: alice,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      exitTokensTx = await mintableERC721Predicate.exitTokens(alice, dummyMintableERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedMintableERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedMintableERC721')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          mintableERC721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog.args.exitor.should.equal(alice)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog.args.rootToken.should.equal(dummyMintableERC721.address)
      })
    })

    it('Token should be minted for alice', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(alice)
    })

    it('alice should be able to deposit token back', async () => {
      await dummyMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: alice })
      const depositData = abi.encode(['uint256'], [tokenId])
      const lockTokensTx = await mintableERC721Predicate.lockTokens(alice, alice, dummyMintableERC721.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Token should be transfered to mintableERC721Predicate', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(mintableERC721Predicate.address)
    })

    it('bob should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      exitTokensTx = await mintableERC721Predicate.exitTokens(bob, dummyMintableERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Token should be transfered to bob', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(bob)
    })
  })

  describe('exitTokens called by different user', () => {
    const tokenId = mockValues.numbers[5]
    const alice = accounts[2]
    const bob = mockValues.addresses[8]
    const exitCaller = mockValues.addresses[3]

    let dummyMintableERC721
    let mintableERC721Predicate
    let exitTokensTx
    let exitedLog0
    let exitedLog1

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: alice,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      exitTokensTx = await mintableERC721Predicate.exitTokens(exitCaller, dummyMintableERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedMintableERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog0 = logs.find(l => l.event === 'ExitedMintableERC721')
      should.exist(exitedLog0)
    })

    describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog0.address.should.equal(
          mintableERC721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog0.args.exitor.should.equal(alice)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog0.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog0.args.rootToken.should.equal(dummyMintableERC721.address)
      })
    })

    it('Token should be minted for alice', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(alice)
    })

    it('alice should be able to deposit token back', async () => {
      await dummyMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: alice })
      const depositData = abi.encode(['uint256'], [tokenId])
      const lockTokensTx = await mintableERC721Predicate.lockTokens(alice, alice, dummyMintableERC721.address, depositData)
      should.exist(lockTokensTx)
    })

    it('Token should be transfered to mintableERC721Predicate', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(mintableERC721Predicate.address)
    })

    it('exitCaller should be able to send exitTokens tx', async () => {
      const burnLog = getERC721TransferLog({
        from: bob,
        to: mockValues.zeroAddress,
        tokenId: tokenId
      })
      exitTokensTx = await mintableERC721Predicate.exitTokens(exitCaller, dummyMintableERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedMintableERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog1 = logs.find(l => l.event === 'ExitedMintableERC721')
      should.exist(exitedLog1)
    })

    describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog1.address.should.equal(
          mintableERC721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper withdrawer', () => {
        exitedLog1.args.exitor.should.equal(bob)
      })

      it('Should emit correct tokenId', () => {
        const exitedLogTokenId = exitedLog1.args.tokenId.toNumber()
        exitedLogTokenId.should.equal(tokenId)
      })

      it('Should emit correct root token', () => {
        exitedLog1.args.rootToken.should.equal(dummyMintableERC721.address)
      })
    })

    it('Token should be transfered to bob', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(bob)
    })
  })

  describe('exitTokens with `TransferWithMetadata` event signature', () => {

    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    const metaData = 'https://nft.matic.network'

    let dummyMintableERC721
    let mintableERC721Predicate
    let exitTokensTx
    let exitedLog

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('Transaction should go through', async () => {
      const burnLog = getERC721TransferWithMetadataLog({
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId,
        metaData
      })

      exitTokensTx = await mintableERC721Predicate.exitTokens(withdrawer, dummyMintableERC721.address, burnLog)
      should.exist(exitTokensTx)
    })

    it('Should emit ExitedMintableERC721 log', () => {
      const logs = logDecoder.decodeLogs(exitTokensTx.receipt.rawLogs)
      exitedLog = logs.find(l => l.event === 'ExitedMintableERC721')
      should.exist(exitedLog)
    })

    describe('Correct values should be emitted in ExitedMintableERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        exitedLog.address.should.equal(
          mintableERC721Predicate.address.toLowerCase()
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
        exitedLog.args.rootToken.should.equal(dummyMintableERC721.address)
      })
    })

    it('Token should be transfered to withdrawer', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(withdrawer)
    })

    it('Token URI should match with transferred metadata', async () => {
      const _metaData = await dummyMintableERC721.tokenURI(tokenId)
      _metaData.should.equal(metaData)
    })

  })

  describe('exitTokens with incorrect burn transaction signature', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC721
    let mintableERC721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        overrideSig: mockValues.bytes32[2],
        from: withdrawer,
        to: mockValues.zeroAddress,
        tokenId
      })
      await expectRevert(mintableERC721Predicate.exitTokens(withdrawer, dummyMintableERC721.address, burnLog), 'MintableERC721Predicate: INVALID_SIGNATURE')
    })
  })

  describe('exitTokens called using normal transfer log instead of burn', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC721
    let mintableERC721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })
      await expectRevert(mintableERC721Predicate.exitTokens(withdrawer, dummyMintableERC721.address, burnLog), 'MintableERC721Predicate: INVALID_RECEIVER')
    })
  })

  describe('exitTokens called by non manager', () => {
    const tokenId = mockValues.numbers[5]
    const withdrawer = mockValues.addresses[8]
    let dummyMintableERC721
    let mintableERC721Predicate

    before(async () => {
      const contracts = await deployer.deployFreshRootContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      mintableERC721Predicate = contracts.mintableERC721Predicate
      const PREDICATE_ROLE = await dummyMintableERC721.PREDICATE_ROLE()
      await dummyMintableERC721.grantRole(PREDICATE_ROLE, mintableERC721Predicate.address)
    })

    it('Should revert with correct reason', async () => {
      const burnLog = getERC721TransferLog({
        from: withdrawer,
        to: mockValues.addresses[8],
        tokenId
      })
      await expectRevert(
        mintableERC721Predicate.exitTokens(withdrawer, dummyMintableERC721.address, burnLog, { from: accounts[2] }),
        'MintableERC721Predicate: INSUFFICIENT_PERMISSIONS')
    })
  })
})
