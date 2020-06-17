import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
const abi = require('ethers/utils/abi-coder').defaultAbiCoder

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('RootChainManager', async(accounts) => {
  describe('Set values', async() => {
    let contracts
    before(async() => {
      contracts = await deployer.deployFreshRootContracts()
    })

    it('Can set stateSenderAddress', async() => {
      const mockStateSenderAddress = mockValues.addresses[0]
      await contracts.rootChainManager.setStateSender(mockStateSenderAddress)
      const stateSenderAddress = await contracts.rootChainManager.stateSenderAddress()
      stateSenderAddress.should.equal(mockStateSenderAddress)
    })

    it('Can set childChainManagerAddress', async() => {
      const mockChildChainManagerAddress = mockValues.addresses[1]
      await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)
      const childChainManagerAddress = await contracts.rootChainManager.childChainManagerAddress()
      childChainManagerAddress.should.equal(mockChildChainManagerAddress)
    })

    it('Can register predicate', async() => {
      const mockType = mockValues.bytes32[2]
      const mockPredicate = mockValues.addresses[4]
      await contracts.rootChainManager.registerPredicate(mockType, mockPredicate)
      const predicate = await contracts.rootChainManager.typeToPredicate(mockType)
      predicate.should.equal(mockPredicate)
    })

    it('Can set rootToChildToken map', async() => {
      await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)

      const mockChildChainManagerAddress = mockValues.addresses[1]
      await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)

      const mockType = mockValues.bytes32[3]
      const mockPredicate = mockValues.addresses[4]
      await contracts.rootChainManager.registerPredicate(mockType, mockPredicate)

      const mockParent = mockValues.addresses[3]
      const mockChild = mockValues.addresses[4]
      await contracts.rootChainManager.mapToken(mockParent, mockChild, mockType)
      const childTokenAddress = await contracts.rootChainManager.rootToChildToken(mockParent)
      childTokenAddress.should.equal(mockChild)
    })

    it('Can set childToRootToken map', async() => {
      await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)

      const mockChildChainManagerAddress = mockValues.addresses[1]
      await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)

      const mockType = mockValues.bytes32[1]
      const mockPredicate = mockValues.addresses[4]
      await contracts.rootChainManager.registerPredicate(mockType, mockPredicate)

      const mockParent = mockValues.addresses[5]
      const mockChild = mockValues.addresses[6]
      await contracts.rootChainManager.mapToken(mockParent, mockChild, mockType)
      const parentTokenAddress = await contracts.rootChainManager.childToRootToken(mockChild)
      parentTokenAddress.should.equal(mockParent)
    })
  })

  describe('deposit ERC20', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC20
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = await dummyERC20.balanceOf(accounts[0])
      oldContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
    })

    it('Account has balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Can approve and deposit', async() => {
      await dummyERC20.approve(contracts.root.erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC20.address, depositData)
      should.exist(depositTx)
    })

    it('Emits LockedERC20 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC20')
      should.exist(lockedLog)
    })

    describe('Correct values emitted in Locked log', () => {
      it('Emitter address', () => {
        lockedLog.address.should.equal(
          contracts.root.erc20Predicate.address.toLowerCase()
        )
      })

      it('amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })

      it('depositReceiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('rootToken', () => {
        lockedLog.args.rootToken.should.equal(dummyERC20.address)
      })
    })

    it('Emits StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
      })

      it('Emitter address', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('depositReceiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('rootToken', () => {
        rootToken.should.equal(dummyERC20.address)
      })

      it('amount', () => {
        const [amount] = abi.decode(['uint256'], depositData)
        const amountBN = new BN(amount.toString())
        amountBN.should.be.a.bignumber.that.equals(depositAmount)
      })

      it('contractAddress', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount deducted from account', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount credited to contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('deposit ERC721', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC721
    let rootChainManager
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(depositTokenId)
    })

    it('Account has token', async() => {
      const owner = await dummyERC721.ownerOf(depositTokenId)
      owner.should.equal(accounts[0])
    })

    it('Can approve and deposit', async() => {
      await dummyERC721.approve(contracts.root.erc721Predicate.address, depositTokenId)
      const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC721.address, depositData)
      should.exist(depositTx)
    })

    it('Emits LockedERC721 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC721')
      should.exist(lockedLog)
    })

    describe('Correct values emitted in Locked log', () => {
      it('Emitter address', () => {
        lockedLog.address.should.equal(
          contracts.root.erc721Predicate.address.toLowerCase()
        )
      })

      it('tokenId', () => {
        const lockedLogTokenId = lockedLog.args.tokenId.toNumber()
        lockedLogTokenId.should.equal(depositTokenId)
      })

      it('depositReceiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('rootToken', () => {
        lockedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('Emits StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
      })

      it('Emitter address', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('depositReceiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('rootToken', () => {
        rootToken.should.equal(dummyERC721.address)
      })

      it('tokenId', () => {
        const [tokenId] = abi.decode(['uint256'], depositData)
        tokenId.toNumber().should.equal(depositTokenId)
      })

      it('contractAddress', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Token transferred', async() => {
      const owner = await dummyERC721.ownerOf(depositTokenId)
      owner.should.equal(contracts.root.erc721Predicate.address)
    })
  })
})
