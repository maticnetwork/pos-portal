import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'

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

  describe('Deposit ERC20', async() => {
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

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC20.approve(contracts.root.erc20Predicate.address, depositAmount)
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC20.address, depositData)
      should.exist(depositTx)
    })

    it('Should emit LockedERC20 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC20')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC20 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.erc20Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(accounts[0])
      })

      it('Should emit correct amount', () => {
        const lockedLogAmount = new BN(lockedLog.args.amount.toString())
        lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
      })

      it('Should emit correct deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit correct root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC20.address)
      })
    })

    it('Should emit StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values should be emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
      })

      it('Event should be emitted by correct contract', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('Should emit correct deposit receiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit correct root token', () => {
        rootToken.should.equal(dummyERC20.address)
      })

      it('Should emit correct amount', () => {
        const [amount] = abi.decode(['uint256'], depositData)
        const amountBN = new BN(amount.toString())
        amountBN.should.be.a.bignumber.that.equals(depositAmount)
      })

      it('Should emit correct contract address', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit ERC721', async() => {
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

    it('Depositor should have token', async() => {
      const owner = await dummyERC721.ownerOf(depositTokenId)
      owner.should.equal(accounts[0])
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC721.approve(contracts.root.erc721Predicate.address, depositTokenId)
      const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC721.address, depositData)
      should.exist(depositTx)
    })

    it('Should emit LockedERC721 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC721')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC721 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(accounts[0])
      })

      it('Should emit proper token id', () => {
        const lockedLogTokenId = lockedLog.args.tokenId.toNumber()
        lockedLogTokenId.should.equal(depositTokenId)
      })

      it('Should emit proper deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC721.address)
      })
    })

    it('Should Emit StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values should be emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
      })

      it('Event should be emitted by correct contract', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('Should emit proper deposit receiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        rootToken.should.equal(dummyERC721.address)
      })

      it('Should eit proper token id', () => {
        const [tokenId] = abi.decode(['uint256'], depositData)
        tokenId.toNumber().should.equal(depositTokenId)
      })

      it('Should emit proper contract address', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Token should be transfered to correct contract', async() => {
      const owner = await dummyERC721.ownerOf(depositTokenId)
      owner.should.equal(contracts.root.erc721Predicate.address)
    })
  })

  describe('Deposit Single ERC1155', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC1155
    let erc1155Predicate
    let rootChainManager
    let depositTx
    let lockedLog
    let stateSyncedlog
    let oldAccountBalance
    let oldContractBalance

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyERC1155 = contracts.root.dummyERC1155
      erc1155Predicate = contracts.root.erc1155Predicate
      rootChainManager = contracts.root.rootChainManager

      const mintAmount = depositAmount.add(mockValues.amounts[2])
      await dummyERC1155.mint(accounts[0], depositTokenId, mintAmount)

      oldAccountBalance = await dummyERC1155.balanceOf(accounts[0], depositTokenId)
      oldContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenId)
    })

    it('Depositor should have enough balance', async() => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true)
      const depositData = abi.encode(
        [
          'uint256[]',
          'uint256[]',
          'bytes'
        ],
        [
          [depositTokenId.toString()],
          [depositAmount.toString()],
          ['0x0']
        ]
      )
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC1155.address, depositData)
      should.exist(depositTx)
    })

    it('Should emit LockedBatchERC1155 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedBatchERC1155')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedBatchERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(accounts[0])
      })

      it('Should emit proper deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id', () => {
        const id = lockedLog.args.ids[0].toNumber()
        id.should.equal(depositTokenId)
      })

      it('Should emit proper amount', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(depositAmount)
      })
    })

    it('Should Emit StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values should be emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
      })

      it('Event should be emitted by correct contract', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('Should emit proper deposit receiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id', () => {
        const [ids] = abi.decode(
          [
            'uint256[]',
            'uint256[]',
            'bytes'
          ],
          depositData
        )
        ids[0].toNumber().should.equal(depositTokenId)
      })

      it('Should emit proper amount', () => {
        const [, amounts] = abi.decode(
          [
            'uint256[]',
            'uint256[]',
            'bytes'
          ],
          depositData
        )
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(depositAmount)
      })

      it('Should emit proper contract address', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], depositTokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount)
      )
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit Batch ERC1155', async() => {
    const depositTokenIdA = mockValues.numbers[4]
    const depositAmountA = mockValues.amounts[3]
    const depositTokenIdB = mockValues.numbers[6]
    const depositAmountB = mockValues.amounts[5]
    const depositTokenIdC = mockValues.numbers[8]
    const depositAmountC = mockValues.amounts[7]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC1155
    let erc1155Predicate
    let rootChainManager
    let depositTx
    let lockedLog
    let stateSyncedlog
    let oldAccountBalanceA
    let oldAccountBalanceB
    let oldAccountBalanceC
    let oldContractBalanceA
    let oldContractBalanceB
    let oldContractBalanceC

    before(async() => {
      contracts = await deployer.deployInitializedContracts()
      dummyERC1155 = contracts.root.dummyERC1155
      erc1155Predicate = contracts.root.erc1155Predicate
      rootChainManager = contracts.root.rootChainManager

      const mintAmountA = depositAmountA.add(mockValues.amounts[9])
      await dummyERC1155.mint(accounts[0], depositTokenIdA, mintAmountA)
      const mintAmountB = depositAmountB.add(mockValues.amounts[2])
      await dummyERC1155.mint(accounts[0], depositTokenIdB, mintAmountB)
      const mintAmountC = depositAmountC.add(mockValues.amounts[1])
      await dummyERC1155.mint(accounts[0], depositTokenIdC, mintAmountC)

      oldAccountBalanceA = await dummyERC1155.balanceOf(accounts[0], depositTokenIdA)
      oldAccountBalanceB = await dummyERC1155.balanceOf(accounts[0], depositTokenIdB)
      oldAccountBalanceC = await dummyERC1155.balanceOf(accounts[0], depositTokenIdC)
      oldContractBalanceA = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdA)
      oldContractBalanceB = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdB)
      oldContractBalanceC = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdC)
    })

    it('Depositor should have enough balance for A', async() => {
      depositAmountA.should.be.a.bignumber.lessThan(oldAccountBalanceA)
    })

    it('Depositor should have enough balance for B', async() => {
      depositAmountB.should.be.a.bignumber.lessThan(oldAccountBalanceB)
    })

    it('Depositor should have enough balance for C', async() => {
      depositAmountC.should.be.a.bignumber.lessThan(oldAccountBalanceC)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(erc1155Predicate.address, true)
      const depositData = abi.encode(
        [
          'uint256[]',
          'uint256[]',
          'bytes'
        ],
        [
          [depositTokenIdA.toString(), depositTokenIdB.toString(), depositTokenIdC.toString()],
          [depositAmountA.toString(), depositAmountB.toString(), depositAmountC.toString()],
          ['0x0']
        ]
      )
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC1155.address, depositData)
      should.exist(depositTx)
    })

    it('Should emit LockedBatchERC1155 log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedBatchERC1155')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedBatchERC1155 log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.erc1155Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(accounts[0])
      })

      it('Should emit proper deposit receiver', () => {
        lockedLog.args.depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        lockedLog.args.rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id for A', () => {
        const id = lockedLog.args.ids[0].toNumber()
        id.should.equal(depositTokenIdA)
      })

      it('Should emit proper token id for B', () => {
        const id = lockedLog.args.ids[1].toNumber()
        id.should.equal(depositTokenIdB)
      })

      it('Should emit proper token id for C', () => {
        const id = lockedLog.args.ids[2].toNumber()
        id.should.equal(depositTokenIdC)
      })

      it('Should emit proper amount for A', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountA)
      })

      it('Should emit proper amount for B', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[1].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountB)
      })

      it('Should emit proper amount for C', () => {
        const amounts = lockedLog.args.amounts
        const amount = new BN(amounts[2].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountC)
      })
    })

    it('Should Emit StateSynced log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      stateSyncedlog = logs.find(l => l.event === 'StateSynced')
      should.exist(stateSyncedlog)
    })

    describe('Correct values should be emitted in StateSynced log', () => {
      let depositReceiver, rootToken, depositData, ids, amounts
      before(() => {
        const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
        const data = abi.decode(['address', 'address', 'bytes'], syncData)
        depositReceiver = data[0]
        rootToken = data[1]
        depositData = data[2]
        const decoded = abi.decode(
          ['uint256[]', 'uint256[]', 'bytes'],
          depositData
        )
        ids = decoded[0]
        amounts = decoded[1]
      })

      it('Event should be emitted by correct contract', () => {
        stateSyncedlog.address.should.equal(
          contracts.root.dummyStateSender.address.toLowerCase()
        )
      })

      it('Should emit proper deposit receiver', () => {
        depositReceiver.should.equal(depositForAccount)
      })

      it('Should emit proper root token', () => {
        rootToken.should.equal(dummyERC1155.address)
      })

      it('Should emit proper token id for A', () => {
        ids[0].toNumber().should.equal(depositTokenIdA)
      })

      it('Should emit proper token id for B', () => {
        ids[1].toNumber().should.equal(depositTokenIdB)
      })

      it('Should emit proper token id for C', () => {
        ids[2].toNumber().should.equal(depositTokenIdC)
      })

      it('Should emit proper amount for A', () => {
        const amount = new BN(amounts[0].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountA)
      })

      it('Should emit proper amount for B', () => {
        const amount = new BN(amounts[1].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountB)
      })

      it('Should emit proper amount for C', () => {
        const amount = new BN(amounts[2].toString())
        amount.should.be.a.bignumber.that.equals(depositAmountC)
      })

      it('Should emit proper contract address', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Deposit amount should be deducted from depositor account for A', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], depositTokenIdA)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceA.sub(depositAmountA)
      )
    })

    it('Deposit amount should be deducted from depositor account for B', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], depositTokenIdB)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceB.sub(depositAmountB)
      )
    })

    it('Deposit amount should be deducted from depositor account for C', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], depositTokenIdC)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalanceC.sub(depositAmountC)
      )
    })

    it('Deposit amount should be credited to correct contract for A', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdA)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceA.add(depositAmountA)
      )
    })

    it('Deposit amount should be credited to correct contract for B', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdB)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceB.add(depositAmountB)
      )
    })

    it('Deposit amount should be credited to correct contract for C', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(erc1155Predicate.address, depositTokenIdC)
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalanceC.add(depositAmountC)
      )
    })
  })
})
