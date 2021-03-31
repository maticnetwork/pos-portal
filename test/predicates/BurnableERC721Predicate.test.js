import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { AbiCoder } from 'ethers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { getERC721TransferLog } from '../helpers/logs'

// Enable and inject BN dependency
chai
    .use(chaiAsPromised)
    .use(chaiBN(BN))
    .should()

const should = chai.should()
const abi = new AbiCoder()

contract('BurnableERC721Predicate', (accounts) => {

    describe('lockTokens with single deposit', () => {
        const tokenId = mockValues.numbers[2]
        const depositReceiver = mockValues.addresses[7]
        const depositor = accounts[1]

        let dummyBurnableERC721
        let burnableERC721Predicate
        let lockTokensTx
        let lockedLog

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC721 = contracts.dummyBurnableERC721
            burnableERC721Predicate = contracts.burnableERC721Predicate

            await dummyBurnableERC721.mint(tokenId, { from: depositor })
            await dummyBurnableERC721.approve(burnableERC721Predicate.address, tokenId, { from: depositor })
        })

        it('Depositor should have token', async () => {
            const owner = await dummyBurnableERC721.ownerOf(tokenId)
            owner.should.equal(depositor)
        })

        it('Depositor should have approved token transfer', async () => {
            const approved = await dummyBurnableERC721.getApproved(tokenId)
            approved.should.equal(burnableERC721Predicate.address)
        })

        it('Should be able to receive lockTokens tx', async () => {
            const depositData = abi.encode(['uint256'], [tokenId])
            lockTokensTx = await burnableERC721Predicate.lockTokens(depositor, depositReceiver, dummyBurnableERC721.address, depositData)
            should.exist(lockTokensTx)
        })

        it('Should emit LockedBurnableERC721 log', () => {
            const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
            lockedLog = logs.find(l => l.event === 'LockedBurnableERC721')
            should.exist(lockedLog)
        })

        describe('Correct values should be emitted in LockedBurnableERC721 log', () => {

            it('Event should be emitted by correct contract', () => {
                lockedLog.address.should.equal(
                    burnableERC721Predicate.address.toLowerCase()
                )
            })

            it('Should emit proper depositor', () => {
                lockedLog.args.depositor.should.equal(depositor)
            })

            it('Should emit correct deposit receiver', () => {
                lockedLog.args.depositReceiver.should.equal(depositReceiver)
            })

            it('Should emit correct root token', () => {
                lockedLog.args.rootToken.should.equal(dummyBurnableERC721.address)
            })

            it('Should emit correct tokenId', () => {
                const lockedLogTokenId = lockedLog.args.tokenId.toNumber()
                lockedLogTokenId.should.equal(tokenId)
            })

        })

        it('token should be transferred to correct contract', async () => {
            const owner = await dummyBurnableERC721.ownerOf(tokenId)
            owner.should.equal(burnableERC721Predicate.address)
        })
    })

    describe('lockTokens with batch deposit', () => {
        const tokenId1 = mockValues.numbers[2]
        const tokenId2 = mockValues.numbers[6]
        const tokenId3 = mockValues.numbers[9]
        const depositReceiver = mockValues.addresses[7]
        const depositor = accounts[1]

        let dummyBurnableERC721
        let burnableERC721Predicate
        let lockTokensTx
        let lockedLog

        before(async () => {
            const contracts = await deployer.deployFreshRootContracts(accounts)

            dummyBurnableERC721 = contracts.dummyBurnableERC721
            burnableERC721Predicate = contracts.burnableERC721Predicate

            await dummyBurnableERC721.mint(tokenId1, { from: depositor })
            await dummyBurnableERC721.mint(tokenId2, { from: depositor })
            await dummyBurnableERC721.mint(tokenId3, { from: depositor })

            await dummyBurnableERC721.setApprovalForAll(burnableERC721Predicate.address, true, { from: depositor })
        })

        it('Depositor should have token', async () => {
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId1)
                owner.should.equal(depositor)
            }
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId2)
                owner.should.equal(depositor)
            }
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId3)
                owner.should.equal(depositor)
            }
        })

        it('Depositor should have approved token transfer', async () => {
            const approved = await dummyBurnableERC721.isApprovedForAll(depositor, burnableERC721Predicate.address)
            approved.should.equal(true)
        })

        it('Should be able to receive lockTokens tx', async () => {
            const depositData = abi.encode(
                ['uint256[]'],
                [
                    [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]
                ]
            )

            lockTokensTx = await burnableERC721Predicate.lockTokens(depositor, depositReceiver, dummyBurnableERC721.address, depositData)
            should.exist(lockTokensTx)
        })

        it('Should emit LockedBurnableERC721Batch log', () => {
            const logs = logDecoder.decodeLogs(lockTokensTx.receipt.rawLogs)
            lockedLog = logs.find(l => l.event === 'LockedBurnableERC721Batch')
            should.exist(lockedLog)
        })

        describe('Correct values should be emitted in LockedBurnableERC721Batch log', () => {
            it('Event should be emitted by correct contract', () => {
                lockedLog.address.should.equal(
                    burnableERC721Predicate.address.toLowerCase()
                )
            })

            it('Should emit proper depositor', () => {
                lockedLog.args.depositor.should.equal(depositor)
            })

            it('Should emit correct deposit receiver', () => {
                lockedLog.args.depositReceiver.should.equal(depositReceiver)
            })

            it('Should emit correct root token', () => {
                lockedLog.args.rootToken.should.equal(dummyBurnableERC721.address)
            })

            it('Should emit correct tokenIds', () => {
                const lockedLogTokenIds = lockedLog.args.tokenIds.map(t => t.toNumber())

                lockedLogTokenIds.should.include(tokenId1)
                lockedLogTokenIds.should.include(tokenId2)
                lockedLogTokenIds.should.include(tokenId3)
            })
        })

        it('token should be transferred to correct contract', async () => {
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId1)
                owner.should.equal(burnableERC721Predicate.address)
            }
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId2)
                owner.should.equal(burnableERC721Predicate.address)
            }
            {
                const owner = await dummyBurnableERC721.ownerOf(tokenId3)
                owner.should.equal(burnableERC721Predicate.address)
            }
        })
    })

})
