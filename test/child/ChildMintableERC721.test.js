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

contract('ChildMintableERC721', (accounts) => {
  describe('Should mint token on deposit', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let contracts
    let depositTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyMintableERC721.DEPOSITOR_ROLE()
      await contracts.dummyMintableERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async() => {
      await expectRevert(contracts.dummyMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('Can receive deposit tx', async() => {
      depositTx = await contracts.dummyMintableERC721.deposit(user, depositData)
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
          contracts.dummyMintableERC721.address.toLowerCase()
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
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })
  })

  describe('Deposit called by non depositor account', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let dummyMintableERC721

    before(async() => {
      const contracts = await deployer.deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
    })

    it('Tx should revert with proper reason', async() => {
      await expectRevert(
        dummyMintableERC721.deposit(user, depositData, { from: accounts[1] }),
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
      await contracts.dummyMintableERC721.mint(user, tokenId)
    })

    it('User should own token', async() => {
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.dummyMintableERC721.withdraw(tokenId)
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
          contracts.dummyMintableERC721.address.toLowerCase()
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
      await expectRevert(contracts.dummyMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Should burn token on withdraw for second time', () => {
    const tokenId = mockValues.numbers[6]
    const user = accounts[0]
    let contracts
    let withdrawTx2
    let transferLog2

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      await contracts.dummyMintableERC721.mint(user, tokenId)
      const DEPOSITOR_ROLE = await contracts.dummyMintableERC721.DEPOSITOR_ROLE()
      await contracts.dummyMintableERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Should be able to withdraw token once', async() => {
      const withdrawTx = await contracts.dummyMintableERC721.withdraw(tokenId)
      should.exist(withdrawTx)
    })

    it('Should be able to deposit token', async() => {
      const depositData = abi.encode(['uint256'], [tokenId])
      const depositTx = await contracts.dummyMintableERC721.deposit(user, depositData)
      should.exist(depositTx)
    })

    it('User should own token', async() => {
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      owner.should.equal(user)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx2 = await contracts.dummyMintableERC721.withdraw(tokenId)
      should.exist(withdrawTx2)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx2.receipt.rawLogs)
      transferLog2 = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog2)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog2.address.should.equal(
          contracts.dummyMintableERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog2.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferLog2.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferLog2.args.tokenId.toNumber()
        transferLogTokenId.should.equal(tokenId)
      })
    })

    it('Token should not exist after burning', async() => {
      await expectRevert(contracts.dummyMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Minting token that has been withdrawn to root chain', () => {
    const user = accounts[0]
    const tokenId = mockValues.numbers[6]
    let dummyMintableERC721

    before(async() => {
      const contracts = await deployer.deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      await dummyMintableERC721.mint(user, tokenId)
      await dummyMintableERC721.withdraw(tokenId)
    })

    it('Token should not exist', async() => {
      await expectRevert(dummyMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('Minting withdrawn token should revert with correct reason', async() => {
      await expectRevert(dummyMintableERC721.mint(user, tokenId), 'Transaction has been reverted by the EVM')
    })
  })
})
