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

})
