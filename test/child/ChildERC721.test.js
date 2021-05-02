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

  describe('Should burn token on withdrawFor', () => {
    const tokenId = mockValues.numbers[6]
    const user = accounts[0]
    const withdrawer = accounts[1]
    let contracts
    let withdrawTx
    let transferLogs
    let transferTransferLog
    let burnTransferLog

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
      withdrawTx = await contracts.dummyERC721.withdrawFor(withdrawer, tokenId)
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLogs = logs.filter(l => l && l.event === 'Transfer')
      transferLogs.length.should.equal(2)

      burnTransferLog = transferLogs.pop()
      transferTransferLog = transferLogs.pop()
    })

    describe('Correct values should be emitted in transfer\'s Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferTransferLog.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferTransferLog.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferTransferLog.args.to.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const transferTransferLogTokenId = transferTransferLog.args.tokenId.toNumber()
        transferTransferLogTokenId.should.equal(tokenId)
      })
    })

    describe('Correct values should be emitted in burn\'s Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        burnTransferLog.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        burnTransferLog.args.from.should.equal(withdrawer)
      })

      it('Should emit proper To', () => {
        burnTransferLog.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct tokenId', () => {
        const burnTransferLogTokenId = burnTransferLog.args.tokenId.toNumber()
        burnTransferLogTokenId.should.equal(tokenId)
      })
    })

    it('Token should not exist after burning', async() => {
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Should burn token on withdrawForBatch', () => {
    const tokenId = mockValues.numbers[6]
    const tokenId1 = mockValues.numbers[7]
    const user = accounts[0]
    const withdrawer = accounts[1]
    let contracts
    let withdrawTx
    let transferLogs
    let burnTransferLogTokenId 
    let transferTransferLogTokenId 
    let burnTransferLogTokenId1 
    let transferTransferLogTokenId1 

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      let depositData = abi.encode(['uint256'], [tokenId])
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC721.deposit(user, depositData)

      depositData = abi.encode(['uint256'], [tokenId1])
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC721.deposit(user, depositData)
    })

    it('User should own token', async() => {
      const owner = await contracts.dummyERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.dummyERC721.withdrawForBatch(withdrawer, [tokenId, tokenId1])
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLogs = logs.filter(l => l && l.event === 'Transfer')
      transferLogs.length.should.equal(4)
      
      burnTransferLogTokenId1 = transferLogs.pop()
      transferTransferLogTokenId1 = transferLogs.pop()
      burnTransferLogTokenId = transferLogs.pop()
      transferTransferLogTokenId = transferLogs.pop()
    })

    describe('Correct values should be emitted in transfer\'s Transfer log for tokenId', () => {
      it('Event should be emitted by correct contract', () => {
        transferTransferLogTokenId1.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferTransferLogTokenId1.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferTransferLogTokenId1.args.to.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const transferTransferLogTokenId1TokenId = transferTransferLogTokenId1.args.tokenId.toNumber()
        transferTransferLogTokenId1TokenId.should.equal(tokenId1)
      })
    })

    describe('Correct values should be emitted in burn\'s Transfer log for tokenId1', () => {
      it('Event should be emitted by correct contract', () => {
        burnTransferLogTokenId1.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        burnTransferLogTokenId1.args.from.should.equal(withdrawer)
      })

      it('Should emit proper To', () => {
        burnTransferLogTokenId1.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct tokenId', () => {
        const burnTransferLogTokenId1TokenId = burnTransferLogTokenId1.args.tokenId.toNumber()
        burnTransferLogTokenId1TokenId.should.equal(tokenId1)
      })
    })

    describe('Correct values should be emitted in transfer\'s Transfer log for tokenId', () => {
      it('Event should be emitted by correct contract', () => {
        transferTransferLogTokenId.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferTransferLogTokenId.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferTransferLogTokenId.args.to.should.equal(withdrawer)
      })

      it('Should emit correct tokenId', () => {
        const transferTransferLogTokenIdTokenId = transferTransferLogTokenId.args.tokenId.toNumber()
        transferTransferLogTokenIdTokenId.should.equal(tokenId)
      })
    })

    describe('Correct values should be emitted in burn\'s Transfer log for tokenId', () => {
      it('Event should be emitted by correct contract', () => {
        burnTransferLogTokenId.address.should.equal(
          contracts.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        burnTransferLogTokenId.args.from.should.equal(withdrawer)
      })

      it('Should emit proper To', () => {
        burnTransferLogTokenId.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct tokenId', () => {
        const burnTransferLogTokenIdTokenId = burnTransferLogTokenId.args.tokenId.toNumber()
        burnTransferLogTokenIdTokenId.should.equal(tokenId)
      })
    })


    it('Token should not exist after burning', async() => {
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
      await expectRevert(contracts.dummyERC721.ownerOf(tokenId1), 'ERC721: owner query for nonexistent token')
    })
  })
})
