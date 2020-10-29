import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as deployer from '../helpers/deployer'
import { mockValues, etherAddress } from '../helpers/constants'
import { constructERC1155DepositData } from '../helpers/utils'
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
      contracts = await deployer.deployFreshRootContracts(accounts)
    })

    it('Can set stateSenderAddress', async() => {
      const mockStateSenderAddress = mockValues.addresses[0]
      await contracts.rootChainManager.setStateSender(mockStateSenderAddress)
      const stateSenderAddress = await contracts.rootChainManager.stateSenderAddress()
      stateSenderAddress.should.equal(mockStateSenderAddress)
    })

    it('Should revert while setting stateSenderAddress from non admin account', async() => {
      const mockStateSenderAddress = mockValues.addresses[3]
      await expectRevert(
        contracts.rootChainManager.setStateSender(mockStateSenderAddress, { from: accounts[4] }),
        'RootChainManager: INSUFFICIENT_PERMISSIONS'
      )
    })

    it('Can set childChainManagerAddress', async() => {
      const mockChildChainManagerAddress = mockValues.addresses[1]
      await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)
      const childChainManagerAddress = await contracts.rootChainManager.childChainManagerAddress()
      childChainManagerAddress.should.equal(mockChildChainManagerAddress)
    })

    it('Should revert while setting childChainManagerAddress from non admin account', async() => {
      const mockChildChainManagerAddress = mockValues.addresses[3]
      await expectRevert(
        contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress, { from: accounts[4] }),
        'RootChainManager: INSUFFICIENT_PERMISSIONS'
      )
    })

    it('Can register predicate', async() => {
      const mockType = mockValues.bytes32[2]
      const mockPredicate = mockValues.addresses[4]
      await contracts.rootChainManager.registerPredicate(mockType, mockPredicate)
      const predicate = await contracts.rootChainManager.typeToPredicate(mockType)
      predicate.should.equal(mockPredicate)
    })

    it('Should revert while registering predicate from non mapper account', async() => {
      const mockType = mockValues.bytes32[3]
      const mockPredicate = mockValues.addresses[5]
      await expectRevert(
        contracts.rootChainManager.registerPredicate(mockType, mockPredicate, { from: accounts[4] }),
        'RootChainManager: INSUFFICIENT_PERMISSIONS'
      )
    })
  })

  describe('Token Mapping', async() => {
    describe('Map fresh token', () => {
      let contracts
      // first set of mock values
      const mockParent = mockValues.addresses[3]
      const mockChild = mockValues.addresses[4]
      const mockType = mockValues.bytes32[3]
      // second set of mock values
      // need to use new values for repeat interaction since tx reverts for same addresses
      const spockParent = mockValues.addresses[5]
      const spockChild = mockValues.addresses[6]

      before(async() => {
        contracts = await deployer.deployFreshRootContracts(accounts)
        await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)

        const mockChildChainManagerAddress = mockValues.addresses[1]
        await contracts.rootChainManager.setChildChainManagerAddress(mockChildChainManagerAddress)

        const mockPredicate = mockValues.addresses[4]
        await contracts.rootChainManager.registerPredicate(mockType, mockPredicate)
      })

      it('Can map token', async() => {
        await contracts.rootChainManager.mapToken(mockParent, mockChild, mockType)
      })

      it('Should set correct rootToChildToken map', async() => {
        const childTokenAddress = await contracts.rootChainManager.rootToChildToken(mockParent)
        childTokenAddress.should.equal(mockChild)
      })

      it('Should set correct childToRootToken map', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(mockChild)
        parentTokenAddress.should.equal(mockParent)
      })

      it('Should fail while mapping token from non mapper account', async() => {
        await expectRevert(
          contracts.rootChainManager.mapToken(spockParent, spockChild, mockType, { from: accounts[4] }),
          'RootChainManager: INSUFFICIENT_PERMISSIONS'
        )
      })

      it('Should fail while mapping token using non existant predicate', async() => {
        const mockType = mockValues.bytes32[0]
        await expectRevert(
          contracts.rootChainManager.mapToken(spockParent, spockChild, mockType),
          'RootChainManager: TOKEN_TYPE_NOT_SUPPORTED'
        )
      })
    })

    // Keep same child token, change mapped parent token
    describe('Tomato has Vegetable as parent, remap to have Fruit as parent', async() => {
      let contracts
      const vegetable = mockValues.addresses[3]
      const fruit = mockValues.addresses[4]
      const tomato = mockValues.addresses[5]
      const tokenType = mockValues.bytes32[3]

      before(async() => {
        contracts = await deployer.deployFreshRootContracts(accounts)
        await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)

        const childChainManagerAddress = mockValues.addresses[1]
        await contracts.rootChainManager.setChildChainManagerAddress(childChainManagerAddress)

        const predicate = mockValues.addresses[2]
        await contracts.rootChainManager.registerPredicate(tokenType, predicate)

        await contracts.rootChainManager.mapToken(vegetable, tomato, tokenType)
      })

      it('Should have Tomato as child of Vegetable', async() => {
        const childTokenAddress = await contracts.rootChainManager.rootToChildToken(vegetable)
        childTokenAddress.should.equal(tomato)
      })

      it('Should have Vegetable as parent of Tomato', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(tomato)
        parentTokenAddress.should.equal(vegetable)
      })

      it('Should fail to noramlly map Tomato as child of Fruit', async() => {
        await expectRevert(
          contracts.rootChainManager.mapToken(fruit, tomato, tokenType),
          'RootChainManager: ALREADY_MAPPED'
        )
      })

      it('Should be able to explicitly remap Tomato as child of Fruit', async() => {
        await contracts.rootChainManager.remapToken(fruit, tomato, tokenType)
      })

      it('Should have Tomato as child of Fruit', async() => {
        const childTokenAddress = await contracts.rootChainManager.rootToChildToken(fruit)
        childTokenAddress.should.equal(tomato)
      })

      it('Should have Fruit as parent of Tomato', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(tomato)
        parentTokenAddress.should.equal(fruit)
      })

      it('Vegetable should not have any child', async() => {
        const parentTokenAddress = await contracts.rootChainManager.rootToChildToken(vegetable)
        parentTokenAddress.should.equal(mockValues.zeroAddress)
      })
    })

    // Keep same parent token, change mapped child token
    describe('Chimp has Baboon as child, remap to have Man as child', async() => {
      let contracts
      const chimp = mockValues.addresses[3]
      const baboon = mockValues.addresses[4]
      const man = mockValues.addresses[5]
      const tokenType = mockValues.bytes32[3]

      before(async() => {
        contracts = await deployer.deployFreshRootContracts(accounts)
        await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)

        const childChainManagerAddress = mockValues.addresses[1]
        await contracts.rootChainManager.setChildChainManagerAddress(childChainManagerAddress)

        const predicate = mockValues.addresses[2]
        await contracts.rootChainManager.registerPredicate(tokenType, predicate)

        await contracts.rootChainManager.mapToken(chimp, baboon, tokenType)
      })

      it('Should have Baboon as child of Chimp', async() => {
        const childTokenAddress = await contracts.rootChainManager.rootToChildToken(chimp)
        childTokenAddress.should.equal(baboon)
      })

      it('Should have Chimp as parent of Baboon', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(baboon)
        parentTokenAddress.should.equal(chimp)
      })

      it('Should fail to noramlly map Chimp to Man', async() => {
        await expectRevert(
          contracts.rootChainManager.mapToken(chimp, man, tokenType),
          'RootChainManager: ALREADY_MAPPED'
        )
      })

      it('Should be able to explicitly remap Chimp to Man', async() => {
        await contracts.rootChainManager.remapToken(chimp, man, tokenType)
      })

      it('Should have Man as child of Chimp', async() => {
        const childTokenAddress = await contracts.rootChainManager.rootToChildToken(chimp)
        childTokenAddress.should.equal(man)
      })

      it('Should have Chimp as parent of Man', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(man)
        parentTokenAddress.should.equal(chimp)
      })

      it('Baboon should not have any parent', async() => {
        const parentTokenAddress = await contracts.rootChainManager.childToRootToken(baboon)
        parentTokenAddress.should.equal(mockValues.zeroAddress)
      })
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
      contracts = await deployer.deployInitializedContracts(accounts)
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

  describe('Deposit ERC20 for zero address', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.zeroAddress
    let rootChainManager
    let dummyERC20

    before(async() => {
      const contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      dummyERC20 = contracts.root.dummyERC20
      await dummyERC20.approve(contracts.root.erc20Predicate.address, depositAmount)
    })

    it('transaction should revert', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, dummyERC20.address, depositData),
        'RootChainManager: INVALID_USER'
      )
    })
  })

  describe('Deposit Ether', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    const gasPrice = new BN('30000000000')
    let contracts
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = new BN(await web3.eth.getBalance(accounts[0]))
      oldContractBalance = new BN(await web3.eth.getBalance(contracts.root.etherPredicate.address))
    })

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Depositor should be able to deposit', async() => {
      depositTx = await rootChainManager.depositEtherFor(depositForAccount, {
        value: depositAmount,
        gasPrice
      })
      should.exist(depositTx)
    })

    it('Should emit LockedEther log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedEther')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedEther log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.etherPredicate.address.toLowerCase()
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
        rootToken.should.equal(etherAddress)
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
      const newAccountBalance = new BN(await web3.eth.getBalance(accounts[0]))
      const gasUsed = new BN(depositTx.receipt.gasUsed)
      const gasCost = gasPrice.mul(gasUsed)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount).sub(gasCost)
      )
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = new BN(await web3.eth.getBalance(contracts.root.etherPredicate.address))
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit Ether by sending to RootChainManager', async() => {
    const depositAmount = mockValues.amounts[1]
    const gasPrice = new BN('30000000000')
    let contracts
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = new BN(await web3.eth.getBalance(accounts[0]))
      oldContractBalance = new BN(await web3.eth.getBalance(contracts.root.etherPredicate.address))
    })

    it('Depositor should have proper balance', () => {
      depositAmount.should.be.a.bignumber.lessThan(oldAccountBalance)
    })

    it('Depositor should be able to deposit', async() => {
      depositTx = await rootChainManager.send(depositAmount, {
        gasPrice
      })
      should.exist(depositTx)
    })

    it('Should emit LockedEther log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedEther')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedEther log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.etherPredicate.address.toLowerCase()
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
        lockedLog.args.depositReceiver.should.equal(accounts[0])
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
        depositReceiver.should.equal(accounts[0])
      })

      it('Should emit correct root token', () => {
        rootToken.should.equal(etherAddress)
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

    it('Deposit amount and gas should be deducted from depositor account', async() => {
      const newAccountBalance = new BN(await web3.eth.getBalance(accounts[0]))
      const gasUsed = new BN(depositTx.receipt.gasUsed)
      const gasCost = gasPrice.mul(gasUsed)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(depositAmount).sub(gasCost)
      )
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = new BN(await web3.eth.getBalance(contracts.root.etherPredicate.address))
      newContractBalance.should.be.a.bignumber.that.equals(
        oldContractBalance.add(depositAmount)
      )
    })
  })

  describe('Deposit Ether by directly calling depositFor', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    let rootChainManager

    before(async() => {
      const contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
    })

    it('transaction should revert', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, etherAddress, depositData),
        'RootChainManager: INVALID_ROOT_TOKEN'
      )
    })
  })

  describe('Deposit Ether for zero address', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.zeroAddress
    let rootChainManager

    before(async() => {
      const contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
    })

    it('transaction should revert', async() => {
      await expectRevert(
        rootChainManager.depositEtherFor(depositForAccount, { value: depositAmount }),
        'RootChainManager: INVALID_USER'
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
      contracts = await deployer.deployInitializedContracts(accounts)
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

  describe('Batch deposit ERC721', async() => {
    const tokenId1 = mockValues.numbers[4]
    const tokenId2 = mockValues.numbers[5]
    const tokenId3 = mockValues.numbers[6]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC721
    let rootChainManager
    let depositTx
    let lockedLog
    let stateSyncedlog

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(tokenId1)
      await dummyERC721.mint(tokenId2)
      await dummyERC721.mint(tokenId3)
    })

    it('Depositor should have the tokens', async() => {
      {
        const owner = await dummyERC721.ownerOf(tokenId1)
        owner.should.equal(accounts[0])
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId2)
        owner.should.equal(accounts[0])
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId3)
        owner.should.equal(accounts[0])
      }
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC721.setApprovalForAll(contracts.root.erc721Predicate.address, true)
      const depositData = abi.encode(
        ['uint256[]'],
        [
          [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]
        ]
      )
      depositTx = await rootChainManager.depositFor(depositForAccount, dummyERC721.address, depositData)
      should.exist(depositTx)
    })

    it('Should emit LockedERC721Batch log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      lockedLog = logs.find(l => l.event === 'LockedERC721Batch')
      should.exist(lockedLog)
    })

    describe('Correct values should be emitted in LockedERC721Batch log', () => {
      it('Event should be emitted by correct contract', () => {
        lockedLog.address.should.equal(
          contracts.root.erc721Predicate.address.toLowerCase()
        )
      })

      it('Should emit proper depositor', () => {
        lockedLog.args.depositor.should.equal(accounts[0])
      })

      it('Should emit proper token ids', () => {
        const lockedLogTokenIds = lockedLog.args.tokenIds.map(t => t.toNumber())
        lockedLogTokenIds.should.include(tokenId1)
        lockedLogTokenIds.should.include(tokenId2)
        lockedLogTokenIds.should.include(tokenId3)
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

      it('Should emit proper token ids', () => {
        const [tokenIds] = abi.decode(['uint256[]'], depositData)
        const tokenIdNumbers = tokenIds.map(t => t.toNumber())
        tokenIdNumbers.should.include(tokenId1)
        tokenIdNumbers.should.include(tokenId2)
        tokenIdNumbers.should.include(tokenId3)
      })

      it('Should emit proper contract address', () => {
        stateSyncedlog.args.contractAddress.should.equal(
          contracts.child.childChainManager.address
        )
      })
    })

    it('Tokens should be transfered to correct contract', async() => {
      {
        const owner = await dummyERC721.ownerOf(tokenId1)
        owner.should.equal(contracts.root.erc721Predicate.address)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId2)
        owner.should.equal(contracts.root.erc721Predicate.address)
      }
      {
        const owner = await dummyERC721.ownerOf(tokenId3)
        owner.should.equal(contracts.root.erc721Predicate.address)
      }
    })
  })

  describe('Deposit ERC721 for zero address', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositForAccount = mockValues.zeroAddress
    let rootChainManager
    let dummyERC721

    before(async() => {
      const contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      dummyERC721 = contracts.root.dummyERC721
      await dummyERC721.mint(depositTokenId)
      await dummyERC721.approve(contracts.root.erc721Predicate.address, depositTokenId)
    })

    it('transaction should revert', async() => {
      const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, dummyERC721.address, depositData),
        'RootChainManager: INVALID_USER'
      )
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
      contracts = await deployer.deployInitializedContracts(accounts)
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
      const depositData = constructERC1155DepositData([depositTokenId], [depositAmount])
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
      contracts = await deployer.deployInitializedContracts(accounts)
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
      const depositData = constructERC1155DepositData(
        [depositTokenIdA, depositTokenIdB, depositTokenIdC],
        [depositAmountA, depositAmountB, depositAmountC]
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

  describe('Deposit ERC1155 for zero address', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.zeroAddress
    let rootChainManager
    let dummyERC1155

    before(async() => {
      const contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      dummyERC1155 = contracts.root.dummyERC1155
      await dummyERC1155.mint(accounts[0], depositTokenId, depositAmount)
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.address, true)
    })

    it('transaction should revert', async() => {
      const depositData = constructERC1155DepositData([depositTokenId], [depositAmount])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, dummyERC1155.address, depositData),
        'RootChainManager: INVALID_USER'
      )
    })
  })

  describe('Depoist token before it is mapped', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    let contracts
    let dummyERC20
    let rootChainManager
    let erc20Predicate

    before(async() => {
      contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      rootChainManager = contracts.rootChainManager
      erc20Predicate = contracts.erc1155Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
    })

    it('Should revert with correct reason', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, dummyERC20.address, depositData),
        'RootChainManager: TOKEN_NOT_MAPPED'
      )
    })
  })

  describe('Depoist token whose predicate is disabled', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    const mockType = mockValues.bytes32[1]
    const mockChild = mockValues.addresses[6]
    let contracts
    let dummyERC20
    let rootChainManager
    let erc20Predicate

    before(async() => {
      contracts = await deployer.deployFreshRootContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      rootChainManager = contracts.rootChainManager
      erc20Predicate = contracts.erc1155Predicate
      await dummyERC20.approve(erc20Predicate.address, depositAmount)
      await contracts.rootChainManager.setStateSender(contracts.dummyStateSender.address)
      await contracts.rootChainManager.setChildChainManagerAddress(mockValues.addresses[1])
      await rootChainManager.registerPredicate(mockType, erc20Predicate.address)
      await rootChainManager.mapToken(dummyERC20.address, mockChild, mockType)
      await rootChainManager.registerPredicate(mockType, mockValues.zeroAddress)
    })

    it('Should revert with correct reason', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await expectRevert(
        rootChainManager.depositFor(depositForAccount, dummyERC20.address, depositData),
        'RootChainManager: INVALID_TOKEN_TYPE'
      )
    })
  })
})
