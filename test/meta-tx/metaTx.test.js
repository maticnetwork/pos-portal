import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { expectRevert } from '@openzeppelin/test-helpers'
import * as sigUtils from 'eth-sig-util'
import * as ethUtils from 'ethereumjs-util'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import { generateFirstWallets, constructERC1155DepositData, getSignatureParameters } from '../helpers/utils'
import { getTypedData } from '../helpers/meta-tx'
import logDecoder from '../helpers/log-decoder.js'

const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')
const ChildERC1155 = artifacts.require('ChildERC1155')
const ChildMintableERC721 = artifacts.require('ChildMintableERC721')
const RootChainManager = artifacts.require('RootChainManager')
const DummyERC20 = artifacts.require('DummyERC20')

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

const web3ChildERC20 = new web3.eth.Contract(ChildERC20.abi)
const web3ChildERC721 = new web3.eth.Contract(ChildERC721.abi)
const web3ChildERC1155 = new web3.eth.Contract(ChildERC1155.abi)
const web3ChildMintableERC721 = new web3.eth.Contract(ChildMintableERC721.abi)
const web3RootChainManager = new web3.eth.Contract(RootChainManager.abi)
const web3DummyERC20 = new web3.eth.Contract(DummyERC20.abi)

const wallets = generateFirstWallets({ n: 10 })

contract('NativeMetaTransaction', (accounts) => {
  describe('Burn ChildERC20 using meta transaction', () => {
    const depositAmount = mockValues.amounts[6]
    const withdrawAmount = mockValues.amounts[3]
    const admin = accounts[0]
    const user = wallets[2].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[2].getPrivateKeyString())
    let contracts
    let dummyERC20

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      const DEPOSITOR_ROLE = await dummyERC20.DEPOSITOR_ROLE()
      await dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [depositAmount.toString(10)])
      await dummyERC20.deposit(user, depositData)
    })

    it('User should own tokens', async() => {
      const balance = await dummyERC20.balanceOf(user)
      balance.should.be.bignumber.gt(withdrawAmount)
    })

    it('Can receive withdraw tx', async() => {
      const functionSignature = await web3ChildERC20.methods.withdraw(withdrawAmount.toString(10)).encodeABI()
      const name = await dummyERC20.name()
      const chainId = await dummyERC20.getChainId()
      const nonce = await dummyERC20.getNonce(user)
      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC20.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      should.exist(tx)
    })

    it('Tokens should be burned for user', async() => {
      const balance = await dummyERC20.balanceOf(user)
      balance.should.be.bignumber.that.equals(depositAmount.sub(withdrawAmount))
    })
  })

  describe('Burn ChildERC721 using meta transaction', () => {
    const tokenId = mockValues.numbers[6]
    const admin = accounts[0]
    const user = wallets[2].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[2].getPrivateKeyString())
    let contracts
    let dummyERC721

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      const DEPOSITOR_ROLE = await dummyERC721.DEPOSITOR_ROLE()
      await dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [tokenId])
      await dummyERC721.deposit(user, depositData)
    })

    it('User should own token', async() => {
      const owner = await dummyERC721.ownerOf(tokenId)
      owner.toLowerCase().should.equal(user.toLowerCase())
    })

    it('Can receive withdraw tx', async() => {
      const functionSignature = await web3ChildERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyERC721.name()
      const chainId = await dummyERC721.getChainId()
      const nonce = await dummyERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC721.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC721.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      should.exist(tx)
    })

    it('Token should not exist after burning', async() => {
      await expectRevert(dummyERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Burn ChildERC20 using meta transaction signed for ERC721', () => {
    const tokenId = mockValues.numbers[6]
    const admin = accounts[0]
    const user = wallets[2].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[2].getPrivateKeyString())
    let contracts
    let dummyERC721
    let dummyERC20

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      dummyERC20 = contracts.dummyERC20
      const DEPOSITOR_ROLE = await dummyERC20.DEPOSITOR_ROLE()
      await dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      await dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [tokenId])
      await dummyERC721.deposit(user, depositData)
      await dummyERC20.deposit(user, depositData)
    })

    it('Should revert transaction', async() => {
      const functionSignature = await web3ChildERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyERC721.name()
      const chainId = await dummyERC721.getChainId()
      const nonce = await dummyERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC721.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      await expectRevert(
        dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin }),
        'Transaction has been reverted by the EVM')
    })
  })

  describe('Burn ChildERC1155 using meta transaction', () => {
    const depositAmount = mockValues.amounts[6]
    const withdrawAmount = mockValues.amounts[3]
    const tokenId = mockValues.numbers[4]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    const admin = accounts[0]
    const user = wallets[3].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[3].getPrivateKeyString())
    let contracts
    let dummyERC1155

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      const DEPOSITOR_ROLE = await dummyERC1155.DEPOSITOR_ROLE()
      await dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
      await dummyERC1155.deposit(user, depositData)
    })

    it('User should own tokens', async() => {
      const balance = await dummyERC1155.balanceOf(user, tokenId)
      balance.should.be.a.bignumber.gt(withdrawAmount)
    })

    it('Can receive withdraw tx', async() => {
      const functionSignature = await web3ChildERC1155.methods.withdrawSingle(tokenId, withdrawAmount.toString(10)).encodeABI()
      const name = await dummyERC1155.uri(0)
      const chainId = await dummyERC1155.getChainId()
      const nonce = await dummyERC1155.getNonce(user)
      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC1155.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC1155.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      should.exist(tx)
    })

    it('Tokens should be burned for user', async() => {
      const balance = await dummyERC1155.balanceOf(user, tokenId)
      balance.should.be.bignumber.that.equals(depositAmount.sub(withdrawAmount))
    })
  })

  describe('Burn MintableChildERC721 using meta transaction', () => {
    const tokenId = mockValues.numbers[6]
    const admin = accounts[0]
    const user = wallets[4].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
    let contracts
    let dummyMintableERC721

    before(async() => {
      contracts = await deployer.deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      await dummyMintableERC721.mint(user, tokenId)
    })

    it('User should own token', async() => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      owner.toLowerCase().should.equal(user.toLowerCase())
    })

    it('Can receive withdraw tx', async() => {
      const functionSignature = await web3ChildMintableERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyMintableERC721.name()
      const chainId = await dummyMintableERC721.getChainId()
      const nonce = await dummyMintableERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyMintableERC721.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyMintableERC721.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      should.exist(tx)
    })

    it('Token should not exist after burning', async() => {
      await expectRevert(dummyMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Approve and deposit ERC20 using meta tx', async() => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    const admin = accounts[0]
    const user = wallets[4].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
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
      await dummyERC20.transfer(user, depositAmount, { from: admin })
      oldAccountBalance = await dummyERC20.balanceOf(user)
      oldContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
    })

    it('User should have proper balance', () => {
      depositAmount.should.be.a.bignumber.lte(oldAccountBalance)
    })

    it('User should be able to approve', async() => {
      const functionSignature = await web3DummyERC20.methods.approve(
        contracts.root.erc20Predicate.address,
        depositAmount.toString(10)
      ).encodeABI()
      const name = await dummyERC20.name()
      const chainId = await dummyERC20.getChainId()
      const nonce = await dummyERC20.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC20.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      should.exist(tx)
    })

    it('User should be able to deposit', async() => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const functionSignature = await web3RootChainManager.methods.depositFor(
        depositForAccount,
        dummyERC20.address,
        depositData
      ).encodeABI()
      const name = 'RootChainManager'
      const chainId = await rootChainManager.getChainId()
      const nonce = await rootChainManager.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: rootChainManager.address,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      depositTx = await rootChainManager.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
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
        lockedLog.args.depositor.toLowerCase().should.equal(user.toLowerCase())
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
      const newAccountBalance = await dummyERC20.balanceOf(user)
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
})
