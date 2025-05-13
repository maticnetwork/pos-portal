import { AbiCoder, toBeHex } from 'ethers'
import { constructERC1155DepositData } from '../helpers/utils.js'
import {
  deployFreshRootContracts,
  deployFreshChildContracts,
  deployInitializedContracts
} from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues, etherAddress } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ChildChainManager', async (accounts) => {
  describe('Map tokens by directly calling function', async () => {
    const mockRootToken = mockValues.addresses[9]
    const mockChildToken = mockValues.addresses[6]
    let contracts
    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
    })

    it('Can receive map token tx', async () => {
      const mapTx = await contracts.childChainManager.mapToken(mockRootToken, mockChildToken)
      expect(mapTx).to.exist
    })

    it('Should set rootToChildToken map', async () => {
      const childToken = await contracts.childChainManager.rootToChildToken(mockRootToken)
      expect(childToken).to.equal(mockChildToken)
    })

    it('Should set childToRootToken map', async () => {
      const rootToken = await contracts.childChainManager.childToRootToken(mockChildToken)
      expect(rootToken).to.equal(mockRootToken)
    })
  })

  describe('Map tokens by calling from non mapper account', async () => {
    const mockRootToken = mockValues.addresses[9]
    const mockChildToken = mockValues.addresses[6]
    let contracts
    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
    })

    it('Tx should revert with correct reason', async () => {
      await expect(
        contracts.childChainManager.connect(await ethers.getSigner(accounts[1])).mapToken(mockRootToken, mockChildToken)
      ).to.be.revertedWith('ChildChainManager: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Map tokens on receiving state', async () => {
    const syncId = mockValues.numbers[8]
    const mockTokenType = mockValues.bytes32[3]
    const mockRootToken = mockValues.addresses[0]
    const mockChildToken = mockValues.addresses[1]
    const syncData = abi.encode(['address', 'address', 'bytes32'], [mockRootToken, mockChildToken, mockTokenType])
    let contracts
    let syncState
    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const parentContracts = await deployFreshRootContracts(accounts)
      const syncType = await parentContracts.rootChainManager.MAP_TOKEN()
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
    })

    it('Can receive map token sync', async () => {
      const stateReceiveTx = await contracts.childChainManager.onStateReceive(syncId, syncState)
      expect(stateReceiveTx).to.exist
    })

    it('Should set rootToChildToken map', async () => {
      const childToken = await contracts.childChainManager.rootToChildToken(mockRootToken)
      expect(childToken).to.equal(mockChildToken)
    })

    it('Should set childToRootToken map', async () => {
      const rootToken = await contracts.childChainManager.childToRootToken(mockChildToken)
      expect(rootToken).to.equal(mockRootToken)
    })
  })

  describe('Tomato has Vegetable as parent, remap to have Fruit as parent', () => {
    const syncId = mockValues.numbers[8]
    const tokenType = mockValues.bytes32[3]
    const vegetable = mockValues.addresses[3]
    const fruit = mockValues.addresses[4]
    const tomato = mockValues.addresses[5]
    const syncData = abi.encode(['address', 'address', 'bytes32'], [fruit, tomato, tokenType])
    let contracts
    let syncState

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const syncType = await contracts.childChainManager.MAP_TOKEN()
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await contracts.childChainManager.mapToken(vegetable, tomato)
    })

    it('Should have Tomato as child of Vegetable', async () => {
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(vegetable)
      expect(childTokenAddress).to.equal(tomato)
    })

    it('Should have Vegetable as parent of Tomato', async () => {
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(tomato)
      expect(parentTokenAddress).to.equal(vegetable)
    })

    it('Should be able to remap Tomato as child of Fruit on receiveing state', async () => {
      await contracts.childChainManager.onStateReceive(syncId, syncState)
    })

    it('Should have Tomato as child of Fruit', async () => {
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(fruit)
      expect(childTokenAddress).to.equal(tomato)
    })

    it('Should have Fruit as parent of Tomato', async () => {
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(tomato)
      expect(parentTokenAddress).to.equal(fruit)
    })

    it('Vegetable should not have any child', async () => {
      const parentTokenAddress = await contracts.childChainManager.rootToChildToken(vegetable)
      expect(parentTokenAddress).to.equal(mockValues.zeroAddress)
    })
  })

  describe('Chimp has Baboon as child, remap to have Man as child', () => {
    const syncId = mockValues.numbers[8]
    const tokenType = mockValues.bytes32[3]
    const baboon = mockValues.addresses[3]
    const chimp = mockValues.addresses[4]
    const man = mockValues.addresses[5]
    const syncData = abi.encode(['address', 'address', 'bytes32'], [chimp, man, tokenType])
    let contracts
    let syncState

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const syncType = await contracts.childChainManager.MAP_TOKEN()
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await contracts.childChainManager.mapToken(chimp, baboon)
    })

    it('Should have Baboon as child of Chimp', async () => {
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(chimp)
      expect(childTokenAddress).to.equal(baboon)
    })

    it('Should have Chimp as parent of Baboon', async () => {
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(baboon)
      expect(parentTokenAddress).to.equal(chimp)
    })

    it('Should be able to remap Man as child of Chimp on receiveing state', async () => {
      await contracts.childChainManager.onStateReceive(syncId, syncState)
    })

    it('Should have Man as child of Chimp', async () => {
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(chimp)
      expect(childTokenAddress).to.equal(man)
    })

    it('Should have Chimp as parent of Man', async () => {
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(man)
      expect(parentTokenAddress).to.equal(chimp)
    })

    it('Baboon should not have any parent', async () => {
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(baboon)
      expect(parentTokenAddress).to.equal(mockValues.zeroAddress)
    })
  })

  describe('Receive state from non state syncer account', () => {
    const syncId = mockValues.numbers[8]
    const mockTokenType = mockValues.bytes32[3]
    const mockRootToken = mockValues.addresses[0]
    const mockChildToken = mockValues.addresses[1]
    const syncData = abi.encode(['address', 'address', 'bytes32'], [mockRootToken, mockChildToken, mockTokenType])
    let contracts
    let syncState
    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const parentContracts = await deployFreshRootContracts(accounts)
      const syncType = await parentContracts.rootChainManager.MAP_TOKEN()
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
    })

    it('Tx should revert with correct reason', async () => {
      await expect(
        contracts.childChainManager.connect(await ethers.getSigner(accounts[1])).onStateReceive(syncId, syncState)
      ).to.be.revertedWith('ChildChainManager: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Receive non supported sync', () => {
    const syncId = mockValues.numbers[3]
    const syncType = mockValues.bytes32[2]
    let contracts
    let syncState
    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, toBeHex(0)])
    })

    it('Tx should revert with correct reason', async () => {
      await expect(contracts.childChainManager.onStateReceive(syncId, syncState)).to.be.revertedWith(
        'ChildChainManager: INVALID_SYNC_TYPE'
      )
    })
  })

  describe('Deposit ERC20 on receiving state', async () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const syncId = mockValues.numbers[0]
    let contracts
    let oldAccountBalance
    let syncState
    // let stateReceiveTx
    // let transferLog

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      oldAccountBalance = await contracts.child.dummyERC20.balanceOf(depositReceiver)
    })

    it('Can receive ERC20 deposit sync', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC20.target, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      syncState = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await expect(contracts.child.childChainManager.onStateReceive(syncId, syncState, { from: accounts[0] }))
        .to.emit(contracts.child.dummyERC20, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, depositAmount)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.child.dummyERC20.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.value.toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit amount should be credited to deposit receiver', async () => {
      const newAccountBalance = await contracts.child.dummyERC20.balanceOf(depositReceiver)
      expect(newAccountBalance).to.be.equal(oldAccountBalance + depositAmount)
    })
  })

  describe('Deposit MaticWETH on receiving state', async () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const syncId = mockValues.numbers[0]
    let contracts
    let oldAccountBalance

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      oldAccountBalance = await contracts.child.maticWETH.balanceOf(depositReceiver)
    })

    it('Can receive MaticWETH deposit sync', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const syncData = abi.encode(['address', 'address', 'bytes'], [depositReceiver, etherAddress, depositData])
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await expect(contracts.child.childChainManager.onStateReceive(syncId, syncBytes, { from: accounts[0] }))
        .to.emit(contracts.child.maticWETH, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, depositAmount)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.child.maticWETH.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.value.toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit amount should be credited to deposit receiver', async () => {
      const newAccountBalance = await contracts.child.maticWETH.balanceOf(depositReceiver)
      expect(newAccountBalance).to.be.equal(oldAccountBalance + depositAmount)
    })
  })

  describe('Deposit ERC721 on receiving state', async () => {
    const depositTokenId = mockValues.numbers[9]
    const depositReceiver = mockValues.addresses[3]
    const syncId = mockValues.numbers[4]
    let contracts
    // let stateReceiveTx
    // let transferLog

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
    })

    it('Token should not exist before deposit', async () => {
      await expect(contracts.child.dummyERC721.ownerOf(depositTokenId)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token'
      )
    })

    it('Can receive ERC721 deposit sync', async () => {
      const depositData = abi.encode(['uint256'], [depositTokenId])
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC721.target, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await expect(contracts.child.childChainManager.onStateReceive(syncId, syncBytes, { from: accounts[0] }))
        .to.emit(contracts.child.dummyERC721, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, depositTokenId)
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.child.dummyERC721.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog.args.tokenId
    //     transferLogTokenId.toNumber().should.equal(depositTokenId)
    //   })
    // })

    it('Deposit token should be credited to deposit receiver', async () => {
      const owner = await contracts.child.dummyERC721.ownerOf(depositTokenId)
      expect(owner).to.equal(depositReceiver)
    })
  })

  describe('Deposit ERC1155 on receiving state', async () => {
    const depositTokenId = mockValues.numbers[9]
    const depositAmount = mockValues.amounts[2]
    const depositReceiver = mockValues.addresses[3]
    const syncId = mockValues.numbers[4]
    let contracts
    // let stateReceiveTx
    // let transferLog
    let oldAccountBalance

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      oldAccountBalance = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenId)
    })

    it('Can receive ERC1155 deposit sync', async () => {
      const depositData = constructERC1155DepositData([depositTokenId], [depositAmount])
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC1155.target, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await expect(contracts.child.childChainManager.onStateReceive(syncId, syncBytes, { from: accounts[0] }))
        .to.emit(contracts.child.dummyERC1155, 'TransferBatch')
        .withArgs(
          contracts.child.childChainManager.target,
          mockValues.zeroAddress,
          depositReceiver,
          [depositTokenId],
          [depositAmount]
        )
    })

    // @note Already verified in the above test
    // it('Should emit TransferBatch log', () => {
    //   const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'TransferBatch')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in TransferBatch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.child.dummyERC1155.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferLog.args.operator.should.equal(contracts.child.childChainManager.target)
    //   })

    //   it('Should emit proper from', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper to', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct tokenId', () => {
    //     const transferLogTokenId = transferLog.args.ids[0]
    //     transferLogTokenId.toNumber().should.equal(depositTokenId)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[0].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit tokens should be credited to deposit receiver', async () => {
      const newAccountBalance = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenId)
      expect(newAccountBalance).to.be.equal(oldAccountBalance + depositAmount)
    })
  })

  describe('Deposit batch ERC1155 on receiving state', async () => {
    const depositTokenIdA = mockValues.numbers[9]
    const depositTokenIdB = mockValues.numbers[3]
    const depositTokenIdC = mockValues.numbers[4]
    const depositAmountA = mockValues.amounts[2]
    const depositAmountB = mockValues.amounts[6]
    const depositAmountC = mockValues.amounts[7]
    const depositReceiver = mockValues.addresses[3]
    const syncId = mockValues.numbers[9]
    let contracts
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldAccountBalanceC

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      oldAccountBalanceA = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdA)
      oldAccountBalanceB = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdB)
      oldAccountBalanceC = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdC)
    })

    it('Can receive ERC1155 deposit sync', async () => {
      const depositData = constructERC1155DepositData(
        [depositTokenIdA, depositTokenIdB, depositTokenIdC],
        [depositAmountA, depositAmountB, depositAmountC]
      )
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC1155.target, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(['bytes32', 'bytes'], [syncType, syncData])
      await expect(contracts.child.childChainManager.onStateReceive(syncId, syncBytes, { from: accounts[0] }))
        .to.emit(contracts.child.dummyERC1155, 'TransferBatch')
        .withArgs(
          contracts.child.childChainManager.target,
          mockValues.zeroAddress,
          depositReceiver,
          [depositTokenIdA, depositTokenIdB, depositTokenIdC],
          [depositAmountA, depositAmountB, depositAmountC]
        )
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'TransferBatch')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in TransferBatch log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.child.dummyERC1155.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper operator', () => {
    //     transferLog.args.operator.should.equal(contracts.child.childChainManager.target)
    //   })

    //   it('Should emit proper from', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper to', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct tokenId for A', () => {
    //     const transferLogTokenId = transferLog.args.ids[0]
    //     transferLogTokenId.toNumber().should.equal(depositTokenIdA)
    //   })

    //   it('Should emit correct tokenId for B', () => {
    //     const transferLogTokenId = transferLog.args.ids[1]
    //     transferLogTokenId.toNumber().should.equal(depositTokenIdB)
    //   })

    //   it('Should emit correct tokenId for C', () => {
    //     const transferLogTokenId = transferLog.args.ids[2]
    //     transferLogTokenId.toNumber().should.equal(depositTokenIdC)
    //   })

    //   it('Should emit correct amount for A', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[0].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountA)
    //   })

    //   it('Should emit correct amount for B', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[1].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountB)
    //   })

    //   it('Should emit correct amount for C', () => {
    //     const transferLogAmount = new BN(transferLog.args.values[2].toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmountC)
    //   })
    // })

    it('Deposit tokens should be credited to deposit receiver for A', async () => {
      const newAccountBalance = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdA)
      expect(newAccountBalance).to.be.equal(oldAccountBalanceA + depositAmountA)
    })

    it('Deposit tokens should be credited to deposit receiver for B', async () => {
      const newAccountBalance = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdB)
      expect(newAccountBalance).to.be.equal(oldAccountBalanceB + depositAmountB)
    })

    it('Deposit tokens should be credited to deposit receiver for C', async () => {
      const newAccountBalance = await contracts.child.dummyERC1155.balanceOf(depositReceiver, depositTokenIdC)
      expect(newAccountBalance).to.be.equal(oldAccountBalanceC + depositAmountC)
    })
  })
})
