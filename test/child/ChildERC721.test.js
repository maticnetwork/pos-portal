import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ChildERC721', (accounts) => {
  describe('Should mint token on deposit', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let contracts
    let depositTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async() => {
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('Can receive deposit tx', async() => {
      depositTx = await contracts.dummyERC721.deposit(user, depositData)
      should.exist(depositTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(mockValues.zeroAddress)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(user)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferLog.args.tokenId.toNumber()
        transferLogTokenId.should.equal(tokenId)
      })
    })

    it('Deposit token should be credited to deposit receiver', async() => {
      const owner = await contracts.dummyERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })
  })

  describe('Should mint tokens on batch deposit', () => {
    const tokenId1 = mockValues.numbers[6]
    const tokenId2 = mockValues.numbers[3]
    const tokenId3 = mockValues.numbers[1]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(
      ['uint256[]'],
      [
        [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]
      ]
    )
    let contracts
    let depositTx
    let transferLogs

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async() => {
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId1), 'ERC721: owner query for nonexistent token')
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId2), 'ERC721: owner query for nonexistent token')
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId3), 'ERC721: owner query for nonexistent token')
    })

    it('Can receive deposit tx', async() => {
      depositTx = await contracts.dummyERC721.deposit(user, depositData)
      should.exist(depositTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      transferLogs = logs.filter(l => l && l.event && l.event === 'Transfer')
      should.exist(transferLogs)
      transferLogs.length.should.equal(3)
    })

    describe('Correct values should be emitted in Transfer logs', () => {
      it('Event should be emitted by correct contract', () => {
        transferLogs.forEach(t => {
          t.address.should.equal(
            contracts.dummyERC721.address.toLowerCase()
          )
        })
      })

      it('Should emit proper From', () => {
        transferLogs.forEach(t => {
          t.args.from.should.equal(mockValues.zeroAddress)
        })
      })

      it('Should emit proper To', () => {
        transferLogs.forEach(t => {
          t.args.to.should.equal(user)
        })
      })

      it('Should emit correct tokenId', () => {
        {
          const transferLogTokenId = transferLogs[0].args.tokenId.toNumber()
          transferLogTokenId.should.equal(tokenId1)
        }
        {
          const transferLogTokenId = transferLogs[1].args.tokenId.toNumber()
          transferLogTokenId.should.equal(tokenId2)
        }
        {
          const transferLogTokenId = transferLogs[2].args.tokenId.toNumber()
          transferLogTokenId.should.equal(tokenId3)
        }
      })
    })

    it('Deposit token should be credited to deposit receiver', async() => {
      {
        const owner = await contracts.dummyERC721.ownerOf(tokenId1)
        owner.should.equal(user)
      }
      {
        const owner = await contracts.dummyERC721.ownerOf(tokenId2)
        owner.should.equal(user)
      }
      {
        const owner = await contracts.dummyERC721.ownerOf(tokenId3)
        owner.should.equal(user)
      }
    })
  })

  describe('Deposit called by non depositor account', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let dummyERC721

    before(async() => {
      const contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
    })

    it('Tx should revert with proper reason', async() => {
      await expectRevert(
        dummyERC721.deposit(user, depositData, { from: accounts[1] }),
        'Transaction has been reverted by the EVM'
      )
    })
  })

  describe('Should burn token on withdraw', () => {
    const tokenId = mockValues.numbers[6]
    const user = accounts[0]
    let contracts
    let withdrawTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const depositData = abi.encode(['uint256'], [tokenId])
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC721.deposit(user, depositData)
    })

    it('User should own token', async() => {
      const owner = await contracts.dummyERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.dummyERC721.withdraw(tokenId)
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferLog.args.tokenId.toNumber()
        transferLogTokenId.should.equal(tokenId)
      })
    })

    it('Token should not exist after burning', async() => {
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })
})
