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

contract('ChildChainManager', async(accounts) => {
  describe('Map tokens', async() => {
    let contracts
    before(async() => {
      contracts = await deployer.deployFreshChildContracts()
    })

    it('Can set rootToChildToken map', async() => {
      const mockParent = mockValues.addresses[0]
      const mockChild = mockValues.addresses[1]
      await contracts.childChainManager.mapToken(mockParent, mockChild)
      const childTokenAddress = await contracts.childChainManager.rootToChildToken(mockParent)
      childTokenAddress.should.equal(mockChild)
    })

    it('Can set childToRootToken map', async() => {
      const mockParent = mockValues.addresses[2]
      const mockChild = mockValues.addresses[3]
      await contracts.childChainManager.mapToken(mockParent, mockChild)
      const parentTokenAddress = await contracts.childChainManager.childToRootToken(mockChild)
      parentTokenAddress.should.equal(mockParent)
    })
  })

  describe('Deposit ERC20 on receiving state', async() => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const syncId = mockValues.numbers[0]
    let contracts
    let oldAccountBalance
    let stateReceiveTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      oldAccountBalance = await contracts.child.dummyERC20.balanceOf(depositReceiver)
    })

    it('Can receive ERC20 deposit sync', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC20.address, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(
        ['bytes32', 'bytes'],
        [syncType, syncData]
      )
      stateReceiveTx = await contracts.child.childChainManager
        .onStateReceive(syncId, syncBytes, { from: accounts[0] })
      should.exist(stateReceiveTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.child.dummyERC20.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(mockValues.zeroAddress)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(depositReceiver)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferLog.args.value.toString())
        transferLogAmount.should.be.bignumber.that.equals(depositAmount)
      })
    })

    it('Deposit amount should be credited to deposit receiver', async() => {
      const newAccountBalance = await contracts.child.dummyERC20.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit ERC721 on receiving state', async() => {
    const depositTokenId = mockValues.numbers[9]
    const depositReceiver = mockValues.addresses[3]
    const syncId = mockValues.numbers[4]
    let contracts
    let stateReceiveTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
    })

    it('Token should not exist before deposit', async() => {
      const call = contracts.child.dummyERC721.ownerOf(depositTokenId)
      call.should.be.rejectedWith(Error)
    })

    it('Can receive ERC721 deposit sync', async() => {
      const depositData = abi.encode(['uint256'], [depositTokenId])
      const syncData = abi.encode(
        ['address', 'address', 'bytes'],
        [depositReceiver, contracts.root.dummyERC721.address, depositData]
      )
      const syncType = await contracts.child.childChainManager.DEPOSIT()
      const syncBytes = abi.encode(
        ['bytes32', 'bytes'],
        [syncType, syncData]
      )
      stateReceiveTx = await contracts.child.childChainManager
        .onStateReceive(syncId, syncBytes, { from: accounts[0] })
      should.exist(stateReceiveTx)
    })

    it('Should emit Transfer log', () => {
      const logs = logDecoder.decodeLogs(stateReceiveTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in Transfer log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.child.dummyERC721.address.toLowerCase()
        )
      })

      it('Should emit proper From', () => {
        transferLog.args.from.should.equal(mockValues.zeroAddress)
      })

      it('Should emit proper To', () => {
        transferLog.args.to.should.equal(depositReceiver)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferLog.args.tokenId
        transferLogTokenId.toNumber().should.equal(depositTokenId)
      })
    })

    it('Deposit token should be credited to deposit receiver', async() => {
      const owner = await contracts.child.dummyERC721.ownerOf(depositTokenId)
      owner.should.equal(depositReceiver)
    })
  })
})
