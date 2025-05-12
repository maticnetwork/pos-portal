import { AbiCoder } from 'ethers'
import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ChildMintableERC721', (accounts) => {
  describe('Should mint token on deposit', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let contracts

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyMintableERC721.DEPOSITOR_ROLE()
      await contracts.dummyMintableERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Token should not exist before deposit', async () => {
      await expect(
        contracts.dummyMintableERC721.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('Can receive deposit tx', async () => {
      await expect(
        contracts.dummyMintableERC721.deposit(user, depositData)
      ).to.emit(contracts.dummyMintableERC721, 'Transfer').withArgs(
        mockValues.zeroAddress,
        user,
        tokenId
      )
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
    //       contracts.dummyMintableERC721.address.toLowerCase()
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
    // })

    it('Deposit token should be credited to deposit receiver', async () => {
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(user)
    })
  })

  describe('Deposit called by non depositor account', () => {
    const tokenId = mockValues.numbers[6]
    const user = mockValues.addresses[3]
    const depositData = abi.encode(['uint256'], [tokenId])
    let dummyMintableERC721

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
    })

    it('Tx should revert with proper reason', async () => {
      await expect(
        dummyMintableERC721.connect(await ethers.getSigner(accounts[1])).deposit(user, depositData)
      ).to.be.revertedWith('ChildMintableERC721: INSUFFICIENT_PERMISSIONS')
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
      await contracts.dummyMintableERC721.mint(user, tokenId)
    })

    it('User should own token', async () => {
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(user)
    })

    it('Can receive withdraw tx', async () => {
      await expect(
        contracts.dummyMintableERC721.withdraw(tokenId)
      ).to.emit(contracts.dummyMintableERC721, 'Transfer').withArgs(
        user,
        mockValues.zeroAddress,
        tokenId
      )
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
    //       contracts.dummyMintableERC721.address.toLowerCase()
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
    // })

    it('Token should not exist after burning', async () => {
      await expect(
        contracts.dummyMintableERC721.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })
  })

  describe('Should burn token on withdraw for second time', () => {
    const tokenId = mockValues.numbers[6]
    const user = accounts[0]
    let contracts
    // let withdrawTx
    // let depositTx

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      await contracts.dummyMintableERC721.mint(user, tokenId)
      const DEPOSITOR_ROLE = await contracts.dummyMintableERC721.DEPOSITOR_ROLE()
      await contracts.dummyMintableERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Should be able to withdraw token once', async () => {
      await expect(
        contracts.dummyMintableERC721.withdraw(tokenId)
      ).to.emit(contracts.dummyMintableERC721, 'Transfer').withArgs(
        user,
        mockValues.zeroAddress,
        tokenId
      )
    })

    it('Should be able to deposit token', async () => {
      const depositData = abi.encode(['uint256'], [tokenId])
      await expect(
        contracts.dummyMintableERC721.deposit(user, depositData)
      ).to.emit(contracts.dummyMintableERC721, 'Transfer').withArgs(
        mockValues.zeroAddress,
        user,
        tokenId
      )
    })

    it('User should own token', async () => {
      const owner = await contracts.dummyMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(user)
    })

    it('Can receive withdraw tx', async () => {
      await expect(
        contracts.dummyMintableERC721.withdraw(tokenId)
      ).to.emit(contracts.dummyMintableERC721, 'Transfer').withArgs(
        user,
        mockValues.zeroAddress,
        tokenId
      )
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(withdrawTx2.receipt.rawLogs)
    //   transferLog2 = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog2)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog2.address.should.equal(
    //       contracts.dummyMintableERC721.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog2.args.from.should.equal(user)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog2.args.to.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog2.args.tokenId.toNumber()
    //     transferLogTokenId.should.equal(tokenId)
    //   })
    // })

    it('Token should not exist after burning', async () => {
      await expect(
        contracts.dummyMintableERC721.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })
  })

  describe('Minting token that has been withdrawn to root chain', () => {
    const user = accounts[0]
    const tokenId = mockValues.numbers[6]
    let dummyMintableERC721

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      await dummyMintableERC721.mint(user, tokenId)
      await dummyMintableERC721.withdraw(tokenId)
    })

    it('Token should not exist', async () => {
      await expect(
        dummyMintableERC721.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('Minting withdrawn token should revert with correct reason', async () => {
      await expect(
        dummyMintableERC721.mint(user, tokenId)
      ).to.be.revertedWith('ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN')
    })
  })
})
