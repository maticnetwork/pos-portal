import { AbiCoder } from 'ethers'
import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ChildERC721', (accounts) => {
  describe('Should mint token on deposit', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let contracts

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async () => {
      await expect(contracts.dummyERC721.ownerOf(tokenId)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
    })

    it('Can receive deposit tx', async () => {
      await expect(contracts.dummyERC721.deposit(user, depositData))
        .to.emit(contracts.dummyERC721, 'Transfer')
        .withArgs(mockValues.zeroAddress, user, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC721.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(user)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog.args.tokenId.toNumber()
    //     transferLogTokenId.should.equal(tokenId)
    //   })

    it('Deposit token should be credited to deposit receiver', async () => {
      const owner = await contracts.dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(user)
    })
  })

  describe('Should mint tokens on batch deposit', () => {
    const tokenId1 = mockValues.numbers[6]
    const tokenId2 = mockValues.numbers[3]
    const tokenId3 = mockValues.numbers[1]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256[]'], [[tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]])
    let contracts
    // let depositTx
    // let transferLogs

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async () => {
      await expect(contracts.dummyERC721.ownerOf(tokenId1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
      await expect(contracts.dummyERC721.ownerOf(tokenId2)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
      await expect(contracts.dummyERC721.ownerOf(tokenId3)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
    })

    it('Can receive deposit tx', async () => {
      // depositTx = await contracts.dummyERC721.deposit(user, depositData)
      // should.exist(depositTx)
      await expect(contracts.dummyERC721.deposit(user, depositData))
        .to.emit(contracts.dummyERC721, 'Transfer')
        .withArgs(mockValues.zeroAddress, user, tokenId1)
        .and.to.emit(contracts.dummyERC721, 'Transfer')
        .withArgs(mockValues.zeroAddress, user, tokenId2)
        .and.to.emit(contracts.dummyERC721, 'Transfer')
        .withArgs(mockValues.zeroAddress, user, tokenId3)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   transferLogs = logs.filter(l => l && l.event && l.event === 'Transfer')
    //   should.exist(transferLogs)
    //   transferLogs.length.should.equal(3)
    // })

    // describe('Correct values should be emitted in Transfer logs', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLogs.forEach(t => {
    //       t.address.should.equal(
    //         contracts.dummyERC721.address.toLowerCase()
    //       )
    //     })
    //   })

    //   it('Should emit proper From', () => {
    //     transferLogs.forEach(t => {
    //       t.args.from.should.equal(mockValues.zeroAddress)
    //     })
    //   })

    //   it('Should emit proper To', () => {
    //     transferLogs.forEach(t => {
    //       t.args.to.should.equal(user)
    //     })
    //   })

    //   it('Should emit correct tokenId', () => {
    //     {
    //       const transferLogTokenId = transferLogs[0].args.tokenId.toNumber()
    //       transferLogTokenId.should.equal(tokenId1)
    //     }
    //     {
    //       const transferLogTokenId = transferLogs[1].args.tokenId.toNumber()
    //       transferLogTokenId.should.equal(tokenId2)
    //     }
    //     {
    //       const transferLogTokenId = transferLogs[2].args.tokenId.toNumber()
    //       transferLogTokenId.should.equal(tokenId3)
    //     }
    //   })

    it('Deposit token should be credited to deposit receiver', async () => {
      const owner1 = await contracts.dummyERC721.ownerOf(tokenId1)
      expect(owner1).to.equal(user)
      const owner2 = await contracts.dummyERC721.ownerOf(tokenId2)
      expect(owner2).to.equal(user)
      const owner3 = await contracts.dummyERC721.ownerOf(tokenId3)
      expect(owner3).to.equal(user)
    })
  })

  describe('Deposit called by non depositor account', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let dummyERC721

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
    })

    it('Tx should revert with proper reason', async () => {
      await expect(
        dummyERC721.connect(await ethers.getSigner(accounts[1])).deposit(user, depositData)
      ).to.be.revertedWith('ChildERC721: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Should burn token on withdraw', () => {
    const tokenId = mockValues.numbers[6]
    const user = accounts[0]
    let contracts
    // let withdrawTx
    // let transferLog

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const depositData = abi.encode(['uint256'], [tokenId])
      const DEPOSITOR_ROLE = await contracts.dummyERC721.DEPOSITOR_ROLE()
      await contracts.dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      await contracts.dummyERC721.deposit(user, depositData)
    })

    it('User should own token', async () => {
      const owner = await contracts.dummyERC721.ownerOf(tokenId)
      expect(owner).to.equal(user)
    })

    it('Can receive withdraw tx', async () => {
      await expect(contracts.dummyERC721.withdraw(tokenId))
        .to.emit(contracts.dummyERC721, 'Transfer')
        .withArgs(user, mockValues.zeroAddress, tokenId)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC721.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(user)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog.args.tokenId.toNumber()
    //     transferLogTokenId.should.equal(tokenId)
    //   })

    it('Token should not exist after burning', async () => {
      await expect(contracts.dummyERC721.ownerOf(tokenId)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
    })
  })
})
