import { AbiCoder } from 'ethers';
import { deployFreshChildContracts, deployInitializedContracts } from '../helpers/deployerNew.js';
import { expect } from 'chai';
import { generateFirstWallets, constructERC1155DepositData, getSignatureParameters } from '../helpers/utils.js';
import { getTypedData } from '../helpers/meta-tx.js';
import { mockValues } from '../helpers/constants.js';

import ethUtils from 'ethereumjs-util';
import sigUtils from 'eth-sig-util';

const abi = new AbiCoder()


contract('NativeMetaTransaction', (accounts) => {
  let wallets = generateFirstWallets({ n: 10 })

  const ChildERC1155 = artifacts.require('ChildERC1155')
  const ChildERC20 = artifacts.require('ChildERC20')
  const ChildERC721 = artifacts.require('ChildERC721')
  const ChildMintableERC721 = artifacts.require('ChildMintableERC721')
  const DummyERC20 = artifacts.require('DummyERC20')
  const RootChainManager = artifacts.require('RootChainManager')


  const web3ChildERC20 = new web3.eth.Contract(ChildERC20.abi)
  const web3ChildERC721 = new web3.eth.Contract(ChildERC721.abi)
  const web3ChildERC1155 = new web3.eth.Contract(ChildERC1155.abi)
  const web3ChildMintableERC721 = new web3.eth.Contract(ChildMintableERC721.abi)
  const web3RootChainManager = new web3.eth.Contract(RootChainManager.abi)
  const web3DummyERC20 = new web3.eth.Contract(DummyERC20.abi)

  describe('Burn ChildERC20 using meta transaction', () => {
    const depositAmount = mockValues.amounts[6]
    const withdrawAmount = mockValues.amounts[3]
    const admin = accounts[0]
    const user = wallets[2].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[2].getPrivateKeyString())
    let contracts
    let dummyERC20

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      dummyERC20 = contracts.dummyERC20
      const DEPOSITOR_ROLE = await dummyERC20.DEPOSITOR_ROLE()
      await dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [depositAmount.toString(10)])
      await dummyERC20.deposit(user, depositData)
    })

    it('User should own tokens', async () => {
      const balance = await dummyERC20.balanceOf(user)
      expect(balance).to.be.greaterThan(withdrawAmount)
    })

    it('Can receive withdraw tx', async () => {
      const functionSignature = await web3ChildERC20.methods.withdraw(withdrawAmount.toString(10)).encodeABI()
      const name = await dummyERC20.name()
      const chainId = await dummyERC20.getChainId()
      const nonce = await dummyERC20.getNonce(user)
      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC20.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      expect(tx).to.exist
    })

    it('Tokens should be burned for user', async () => {
      const balance = await dummyERC20.balanceOf(user)
      expect(balance).to.equal(depositAmount - withdrawAmount)
    })
  })

  describe('Burn ChildERC721 using meta transaction', () => {
    const tokenId = mockValues.numbers[6]
    const admin = accounts[0]
    const user = wallets[2].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[2].getPrivateKeyString())
    let contracts
    let dummyERC721

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      const DEPOSITOR_ROLE = await dummyERC721.DEPOSITOR_ROLE()
      await dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [tokenId])
      await dummyERC721.deposit(user, depositData)
    })

    it('User should own token', async () => {
      const owner = await dummyERC721.ownerOf(tokenId)
      expect(owner.toLowerCase()).to.equal(user.toLowerCase())
    })

    it('Can receive withdraw tx', async () => {
      const functionSignature = await web3ChildERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyERC721.name()
      const chainId = await dummyERC721.getChainId()
      const nonce = await dummyERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC721.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC721.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Token should not exist after burning', async () => {
      await expect(dummyERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token')
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

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      dummyERC721 = contracts.dummyERC721
      dummyERC20 = contracts.dummyERC20
      const DEPOSITOR_ROLE = await dummyERC20.DEPOSITOR_ROLE()
      await dummyERC721.grantRole(DEPOSITOR_ROLE, accounts[0])
      await dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [tokenId])
      await dummyERC721.connect(await ethers.getSigner(accounts[0])).deposit(user, depositData)
      await dummyERC20.connect(await ethers.getSigner(accounts[0])).deposit(user, depositData)
    })

    it('Should revert transaction', async () => {
      const functionSignature = await web3ChildERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyERC721.name()
      const chainId = await dummyERC721.getChainId()
      const nonce = await dummyERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC721.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      await expect(dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin }))
        .to.be.revertedWith('Signer and signature do not match')
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

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      dummyERC1155 = contracts.dummyERC1155
      const DEPOSITOR_ROLE = await dummyERC1155.DEPOSITOR_ROLE()
      await dummyERC1155.grantRole(DEPOSITOR_ROLE, accounts[0])
      await dummyERC1155.deposit(user, depositData)
    })

    it('User should own tokens', async () => {
      const balance = await dummyERC1155.balanceOf(user, tokenId)
      expect(balance).to.be.greaterThan(withdrawAmount)
    })

    it('Can receive withdraw tx', async () => {
      const functionSignature = await web3ChildERC1155.methods.withdrawSingle(tokenId, withdrawAmount.toString(10)).encodeABI()
      const name = await dummyERC1155.uri(0)
      const chainId = await dummyERC1155.getChainId()
      const nonce = await dummyERC1155.getNonce(user)
      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyERC1155.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC1155.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Tokens should be burned for user', async () => {
      const balance = await dummyERC1155.balanceOf(user, tokenId)
      expect(balance).to.equal(depositAmount - withdrawAmount)
    })
  })

  describe('Burn MintableChildERC721 using meta transaction', () => {
    const tokenId = mockValues.numbers[6]
    const admin = accounts[0]
    const user = wallets[4].getAddressString()
    const userPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
    let contracts
    let dummyMintableERC721

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      dummyMintableERC721 = contracts.dummyMintableERC721
      await dummyMintableERC721.mint(user, tokenId)
    })

    it('User should own token', async () => {
      const owner = await dummyMintableERC721.ownerOf(tokenId)
      expect(owner.toLowerCase()).to.equal(user.toLowerCase())
    })

    it('Can receive withdraw tx', async () => {
      const functionSignature = await web3ChildMintableERC721.methods.withdraw(tokenId).encodeABI()
      const name = await dummyMintableERC721.name()
      const chainId = await dummyMintableERC721.getChainId()
      const nonce = await dummyMintableERC721.getNonce(user)

      const sig = sigUtils.signTypedData(userPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: dummyMintableERC721.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyMintableERC721.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Token should not exist after burning', async () => {
      await expect(dummyMintableERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })
  })

  describe('Approve and deposit ERC20 using meta tx', () => {
    const depositAmount = mockValues.amounts[1]
    const depositForAccount = mockValues.addresses[0]
    const admin = accounts[0]
    const user = ethers.getAddress(wallets[4].getAddressString())
    const userPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
    let contracts
    let dummyERC20
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let lockedLog
    let stateSyncedlog

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      await dummyERC20.transfer(user, depositAmount, { from: admin })
      oldAccountBalance = await dummyERC20.balanceOf(user)
      oldContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
    })

    it('User should have proper balance', () => {
      expect(oldAccountBalance).to.be.lessThanOrEqual(depositAmount)
    })

    it('User should be able to approve', async () => {
      const functionSignature = await web3DummyERC20.methods.approve(
        contracts.root.erc20Predicate.target,
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
          verifyingContract: dummyERC20.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await dummyERC20.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('User should be able to deposit', async () => {
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      const functionSignature = await web3RootChainManager.methods.depositFor(
        depositForAccount,
        dummyERC20.target,
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
          verifyingContract: rootChainManager.target,
          nonce: '0x' + nonce.toString(16),
          from: user,
          functionSignature: ethUtils.toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const stateSyncData = abi.encode(['bytes32', 'bytes'], [ethers.solidityPackedKeccak256(["string"], ["DEPOSIT"]),
      abi.encode(['address', 'address', 'bytes'], [depositForAccount, dummyERC20.target, depositData])])

      await expect(rootChainManager.executeMetaTransaction(user, functionSignature, r, s, v, { from: admin })).
        to.emit(contracts.root.erc20Predicate, 'LockedERC20').
        withArgs(user, depositForAccount, dummyERC20.target, depositAmount).
        to.emit(contracts.root.dummyStateSender, 'StateSynced').
        withArgs(1, contracts.child.childChainManager.target, stateSyncData)
    })

    // @note Already verified in the above test
    // it('Should emit LockedERC20 log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   lockedLog = logs.find(l => l.event === 'LockedERC20')
    //   should.exist(lockedLog)
    // })

    // describe('Correct values should be emitted in LockedERC20 log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     lockedLog.target.should.equal(
    //       contracts.root.erc20Predicate.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper depositor', () => {
    //     lockedLog.args.depositor.toLowerCase().should.equal(user.toLowerCase())
    //   })

    //   it('Should emit correct amount', () => {
    //     const lockedLogAmount = new BN(lockedLog.args.amount.toString())
    //     lockedLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     lockedLog.args.depositReceiver.should.equal(depositForAccount)
    //   })

    //   it('Should emit correct root token', () => {
    //     lockedLog.args.rootToken.should.equal(dummyERC20.target)
    //   })
    // })

    // it('Should emit StateSynced log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   stateSyncedlog = logs.find(l => l.event === 'StateSynced')
    //   should.exist(stateSyncedlog)
    // })

    // describe('Correct values should be emitted in StateSynced log', () => {
    //   let depositReceiver, rootToken, depositData
    //   before(() => {
    //     const [, syncData] = abi.decode(['bytes32', 'bytes'], stateSyncedlog.args.data)
    //     const data = abi.decode(['address', 'address', 'bytes'], syncData)
    //     depositReceiver = data[0]
    //     rootToken = data[1]
    //     depositData = data[2]
    //   })

    //   it('Event should be emitted by correct contract', () => {
    //     stateSyncedlog.target.should.equal(
    //       contracts.root.dummyStateSender.target.toLowerCase()
    //     )
    //   })

    //   it('Should emit correct deposit receiver', () => {
    //     depositReceiver.should.equal(depositForAccount)
    //   })

    //   it('Should emit correct root token', () => {
    //     rootToken.should.equal(dummyERC20.target)
    //   })

    //   it('Should emit correct amount', () => {
    //     const [amount] = abi.decode(['uint256'], depositData)
    //     const amountBN = new BN(amount.toString())
    //     amountBN.should.be.a.bignumber.that.equals(depositAmount)
    //   })

    //   it('Should emit correct contract address', () => {
    //     stateSyncedlog.args.contractAddress.should.equal(
    //       contracts.child.childChainManager.target
    //     )
    //   })
    // })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(user)
      expect(newAccountBalance).to.equal(oldAccountBalance - depositAmount)
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance + depositAmount)
    })
  })
})
