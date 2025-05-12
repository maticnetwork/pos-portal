import { AbiCoder } from 'ethers'
import { bufferToHex, rlp } from 'ethereumjs-util'
import { constructERC1155DepositData, syncState } from '../helpers/utils.js'
import { deployInitializedContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { getFakeReceiptBytes, getDiffEncodedReceipt } from '../helpers/proofs.js'
import { mockValues } from '../helpers/constants.js'
import { submitCheckpoint } from '../helpers/checkpoint.js'

const abi = new AbiCoder()

const ERC721_TRANSFER_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ERC721_WITHDRAW_BATCH_EVENT_SIG = '0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df'

const toHex = (buf) => {
  buf = buf.toString('hex')
  if (buf.substring(0, 2) == '0x') { return buf }
  return '0x' + buf.toString('hex')
}

function pad(n, width, z) {
  z = z || '0'
  n = n + ''
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
}

contract('RootChainManager', async (accounts) => {
  describe('Withdraw ERC20', async () => {
    const depositAmount = mockValues.amounts[1]
    let totalDepositedAmount = 0n
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let dummyERC20
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = await dummyERC20.balanceOf(accounts[0])
      oldContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC20.approve(contracts.root.erc20Predicate.target, depositAmount)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC20.target, depositData)
      expect(depositTx).to.exist
      totalDepositedAmount += depositAmount
      let txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Second depositor should be able to approve and deposit', async () => {
      await dummyERC20.mint(depositAmount)
      await dummyERC20.transfer(accounts[2], depositAmount)
      await dummyERC20.connect(await ethers.getSigner(accounts[2])).approve(contracts.root.erc20Predicate.target, mockValues.amounts[2])
      const depositTx = await rootChainManager.connect(await ethers.getSigner(accounts[2])).depositFor(accounts[2], dummyERC20.target, depositData)
      expect(depositTx).to.exist
      totalDepositedAmount += depositAmount
      let txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      expect(newAccountBalance).to.equal(oldAccountBalance - depositAmount)
      // update account balance
      oldAccountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance + totalDepositedAmount)

      // update balance
      oldContractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC20.connect(await ethers.getSigner(depositReceiver)).withdraw(withdrawAmount)
      expect(withdrawTx).to.exist

      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC20, 'Transfer')
        .withArgs(depositReceiver, mockValues.zeroAddress, withdrawAmount)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should fail to start exit (changed the block number to future block)', async () => {
      const logIndex = 0
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should fail to start exit (changed the block number with different encoding)', async () => {
      const logIndex = 0
      const fakeBlockNumber = pad(checkpointData.number, 64)
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: exit with a differently encoded amount data in receipt', async () => {
      const dummyReceipt = getDiffEncodedReceipt(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      // await expectRevert(contracts.root.rootChainManager.exit(data,
      //   { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(64).fill(0).join(''))
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, withdrawAmount)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(depositReceiver)
      expect(newAccountBalance).to.equal(oldAccountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })
  })

  describe('Withdraw ERC20 :: non-deposit account', async () => {
    const depositAmount = mockValues.amounts[1]
    let totalDepositedAmount = 0n
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let dummyERC20
    let rootChainManager
    let oldAccountBalance
    let oldContractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      oldAccountBalance = await dummyERC20.balanceOf(accounts[0])
      oldContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC20.approve(contracts.root.erc20Predicate.target, depositAmount)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC20.target, depositData)
      expect(depositTx).to.exist
      totalDepositedAmount += depositAmount
      let txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Second depositor should be able to approve and deposit', async () => {
      await dummyERC20.mint(depositAmount)
      await dummyERC20.transfer(accounts[2], depositAmount)
      await dummyERC20.connect(await ethers.getSigner(accounts[2])).approve(contracts.root.erc20Predicate.target, mockValues.amounts[2])
      const depositTx = await rootChainManager.connect(await ethers.getSigner(accounts[2])).depositFor(accounts[2], dummyERC20.target, depositData)
      expect(depositTx).to.exist
      totalDepositedAmount += depositAmount
      let txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      expect(newAccountBalance).to.equal(oldAccountBalance - depositAmount)
      // update account balance
      oldAccountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance + totalDepositedAmount)

      // update balance
      oldContractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC20.connect(await ethers.getSigner(depositReceiver)).withdraw(withdrawAmount)
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC20, 'Transfer')
        .withArgs(depositReceiver, mockValues.zeroAddress, withdrawAmount)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith
    })

    it('Should fail to start exit (changed the block number to future block)', async () => {
      const logIndex = 0
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should fail to start exit (changed the block number with different encoding)', async () => {
      const logIndex = 0
      const fakeBlockNumber = pad(checkpointData.number, 64)
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.reverted
    })

    // call exit from some account other than depositReceiver
    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: exit with a differently encoded amount data in receipt', async () => {
      const dummyReceipt = getDiffEncodedReceipt(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(64).fill(0).join(''))
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, withdrawAmount)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC20.balanceOf(depositReceiver)
      expect(newAccountBalance).to.equal(oldAccountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.target)
      expect(newContractBalance).to.equal(oldContractBalance - withdrawAmount)
    })
  })

  describe('Withdraw ERC721', async () => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = 1n
    const withdrawAmount = 1n
    const depositReceiver = accounts[0]
    const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
    let contracts
    let dummyERC721
    let rootChainManager
    let accountBalance
    let contractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(depositTokenId)
      accountBalance = await dummyERC721.balanceOf(accounts[0])
      contractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC721.approve(contracts.root.erc721Predicate.target, depositTokenId)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC721.target, depositData)
      expect(depositTx).to.exist
      let txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC721.balanceOf(accounts[0])
      expect(newAccountBalance).to.equal(accountBalance - depositAmount)

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
      expect(newContractBalance).to.equal(contractBalance + depositAmount)

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC721.connect(await ethers.getSigner(depositReceiver)).withdraw(depositTokenId)
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC721, 'Transfer')
        .withArgs(depositReceiver, mockValues.zeroAddress, depositTokenId)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should fail to start exit (changed the block number)', async () => {
      const logIndex = 1
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should start exit', async () => {
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(63).fill(0).join('') + '1')
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      // start exit
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, depositTokenId)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC721.balanceOf(depositReceiver)
      expect(newAccountBalance).to.equal(accountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
      expect(newContractBalance).to.equal(contractBalance - withdrawAmount)
    })
  })

  describe('Withdraw batch ERC721', async () => {
    const tokenId1 = mockValues.numbers[4]
    const tokenId2 = mockValues.numbers[5]
    const tokenId3 = mockValues.numbers[8]
    const user = accounts[0]
    const depositData = abi.encode(
      ['uint256[]'],
      [
        [tokenId1.toString(), tokenId2.toString(), tokenId3.toString()]
      ]
    )
    let contracts
    let rootToken
    let childToken
    let rootChainManager
    let checkpointManager
    let erc721Predicate
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx1
    let exitTx2
    let exitTx3

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      rootToken = contracts.root.dummyERC721
      childToken = contracts.child.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      checkpointManager = contracts.root.checkpointManager
      erc721Predicate = contracts.root.erc721Predicate
      await rootToken.mint(tokenId1)
      await rootToken.mint(tokenId2)
      await rootToken.mint(tokenId3)
    })

    it('User should own tokens on root chain', async () => {
      {
        const owner = await rootToken.ownerOf(tokenId1)
        expect(owner).to.equal(user)
      }
      {
        const owner = await rootToken.ownerOf(tokenId2)
        expect(owner).to.equal(user)

      }
      {
        const owner = await rootToken.ownerOf(tokenId3)
        expect(owner).to.equal(user)

      }
    })

    it('Tokens should not exist on child chain', async () => {
      await expect(childToken.ownerOf(tokenId1)).to.be.revertedWith('ERC721: owner query for nonexistent token')
      await expect(childToken.ownerOf(tokenId2)).to.be.revertedWith('ERC721: owner query for nonexistent token')
      await expect(childToken.ownerOf(tokenId3)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('User should be able to approve and deposit', async () => {
      await rootToken.setApprovalForAll(erc721Predicate.target, true)
      const depositTx = await rootChainManager.depositFor(user, rootToken.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Predicate should own tokens on root chain', async () => {
      {
        const owner = await rootToken.ownerOf(tokenId1)
        expect(owner).to.equal(erc721Predicate.target)
      }
      {
        const owner = await rootToken.ownerOf(tokenId2)
        expect(owner).to.equal(erc721Predicate.target)
      }
      {
        const owner = await rootToken.ownerOf(tokenId3)
        expect(owner).to.equal(erc721Predicate.target)
      }
    })

    it('User should own tokens on child chain', async () => {
      {
        const owner = await childToken.ownerOf(tokenId1)
        expect(owner).to.equal(user)
      }
      {
        const owner = await childToken.ownerOf(tokenId2)
        expect(owner).to.equal(user)
      }
      {
        const owner = await childToken.ownerOf(tokenId3)
        expect(owner).to.equal(user)
      }
    })

    it('User should be able to start withdraw', async () => {
      withdrawTx = await childToken.withdrawBatch([tokenId1, tokenId2, tokenId3])
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('User should fail to exit with WithdrawnBatch', async () => {
      const logIndex = withdrawTxReceipt.logs
        .findIndex(log => log.topics[0].toLowerCase() === ERC721_WITHDRAW_BATCH_EVENT_SIG.toLowerCase())
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      // attempt exit, but fail due to mismatching event signature
      // read PR description of https://github.com/maticnetwork/pos-portal-private/pull/1
      await expect(contracts.root.rootChainManager.exit(data)).to.be.revertedWith('ERC721Predicate: INVALID_SIGNATURE')
    })

    it('User should be able to exit tokenId1 with Transfer', async () => {
      const logIndices = []
      withdrawTxReceipt.logs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      expect(logIndices.length).to.equal(3)

      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndices[0]
        ])
      )
      exitTx1 = await contracts.root.rootChainManager.exit(data)
      expect(exitTx1).to.exist
    })

    it('User should own tokenId1 on root chain', async () => {
      const owner = await rootToken.ownerOf(tokenId1)
      expect(owner).to.equal(user)
    })

    it('User should be able to exit tokenId2 with Transfer', async () => {
      const logIndices = []
      withdrawTxReceipt.logs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      expect(logIndices.length).to.equal(3)

      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndices[1]
        ])
      )
      exitTx2 = await contracts.root.rootChainManager.exit(data)
      expect(exitTx2).to.exist
    })

    it('User should own tokenId2 on root chain', async () => {
      const owner = await rootToken.ownerOf(tokenId2)
      expect(owner).to.equal(user)
    })

    it('User should be able to exit tokenId3 with Transfer', async () => {
      const logIndices = []
      withdrawTxReceipt.logs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      expect(logIndices.length).to.equal(3)

      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndices[2]
        ])
      )
      exitTx3 = await contracts.root.rootChainManager.exit(data)
      expect(exitTx3).to.exist
    })

    it('User should own tokenId3 on root chain', async () => {
      const owner = await rootToken.ownerOf(tokenId3)
      expect(owner).to.equal(user)
    })

    it('Tokens should not exist on child chain', async () => {
      await expect(childToken.ownerOf(tokenId1)).to.be.revertedWith('ERC721: owner query for nonexistent token')
      await expect(childToken.ownerOf(tokenId2)).to.be.revertedWith('ERC721: owner query for nonexistent token')
      await expect(childToken.ownerOf(tokenId3)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })
  })

  describe('Withdraw ERC721 :: non-deposit account', async () => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = 1n
    const withdrawAmount = 1n
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
    let contracts
    let dummyERC721
    let rootChainManager
    let accountBalance
    let contractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(depositTokenId)
      accountBalance = await dummyERC721.balanceOf(accounts[0])
      contractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC721.approve(contracts.root.erc721Predicate.target, depositTokenId)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC721.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC721.balanceOf(accounts[0])
      expect(newAccountBalance).to.equal(accountBalance - depositAmount)

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
      expect(newContractBalance).to.equal(contractBalance + depositAmount)

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC721.connect(await ethers.getSigner(depositReceiver)).withdraw(depositTokenId)
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC721, 'Transfer')
        .withArgs(depositReceiver, mockValues.zeroAddress, depositTokenId)
    })

    it('Should submit checkpoint', async () => {
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.reverted
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.reverted
    })

    it('Should fail to start exit (changed the block number)', async () => {
      const logIndex = 1
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should start exit', async () => {
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(63).fill(0).join('') + '1')
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'Transfer')
        .withArgs(mockValues.zeroAddress, depositReceiver, depositTokenId)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC721.balanceOf(depositReceiver)
      expect(newAccountBalance).to.equal(accountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.target)
      expect(newContractBalance).to.equal(contractBalance - withdrawAmount)
    })
  })

  describe('Withdraw single ERC1155', async () => {
    const tokenId = mockValues.numbers[8]
    const depositAmount = mockValues.amounts[1]
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const depositData = abi.encode(
      [
        'uint256[]',
        'uint256[]',
        'bytes'
      ],
      [
        [tokenId.toString()],
        [depositAmount.toString()],
        '0x'
      ]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalance
    let contractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      const mintAmount = depositAmount + mockValues.amounts[2]
      await dummyERC1155.mint(accounts[0], tokenId, mintAmount)
      accountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      contractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.target, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      expect(newAccountBalance).to.equal(accountBalance - depositAmount)

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(contractBalance + depositAmount)

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC1155.connect(await ethers.getSigner(depositReceiver)).withdrawSingle(tokenId, withdrawAmount)
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC1155, 'TransferSingle')
        .withArgs(depositReceiver, mockValues.zeroAddress, tokenId, withdrawAmount)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should fail to start exit (changed the block number)', async () => {
      const logIndex = 0
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(64).fill(0).join(''))
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'TransferSingle')
        .withArgs(mockValues.zeroAddress, depositReceiver, tokenId, withdrawAmount)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositReceiver, tokenId)
      expect(newAccountBalance).to.equal(accountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(contractBalance - withdrawAmount)
    })
  })

  describe('Withdraw single ERC1155 :: non-deposit account', async () => {
    const tokenId = mockValues.numbers[8]
    const depositAmount = mockValues.amounts[1]
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = abi.encode(
      [
        'uint256[]',
        'uint256[]',
        'bytes'
      ],
      [
        [tokenId.toString()],
        [depositAmount.toString()],
        '0x'
      ]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalance
    let contractBalance
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      const mintAmount = depositAmount + mockValues.amounts[2]
      await dummyERC1155.mint(accounts[0], tokenId, mintAmount)
      accountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      contractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.target, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      expect(newAccountBalance).to.equal(accountBalance - depositAmount)

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(contractBalance + depositAmount)

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC1155.connect(await ethers.getSigner(depositReceiver)).withdrawSingle(tokenId, withdrawAmount)
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC1155, 'TransferSingle')
        .withArgs(depositReceiver, mockValues.zeroAddress, tokenId, withdrawAmount)
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.reverted
    })

    it('Should fail to start exit (changed the block number)', async () => {
      const logIndex = 0
      const fakeBlockNumber = checkpointData.number + 1
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          fakeBlockNumber,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('Leaf index is too big')
    })

    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data)
      expect(exitTx).to.exist
    })

    it('Should fail: start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async () => {
      const logIndex = toHex(Array(64).fill(0).join(''))
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'TransferSingle')
        .withArgs(mockValues.zeroAddress, depositReceiver, tokenId, withdrawAmount)
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositReceiver, tokenId)
      expect(newAccountBalance).to.equal(accountBalance + depositAmount)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.target, tokenId)
      expect(newContractBalance).to.equal(contractBalance - withdrawAmount)
    })
  })

  describe('Withdraw batch ERC1155', async () => {
    let erc1155PredicateAddress
    const withdrawAmountA = mockValues.amounts[2]
    const withdrawAmountB = mockValues.amounts[2]
    const withdrawAmountC = mockValues.amounts[1]
    const depositAmountA = withdrawAmountA + mockValues.amounts[0]
    const depositAmountB = withdrawAmountA + mockValues.amounts[9]
    const depositAmountC = withdrawAmountA + mockValues.amounts[6]
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const tokenIdC = mockValues.numbers[8]
    const depositReceiver = accounts[0]
    const depositData = constructERC1155DepositData(
      [tokenIdA, tokenIdB, tokenIdC],
      [depositAmountA, depositAmountB, depositAmountC]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalanceA
    let accountBalanceB
    let accountBalanceC
    let contractBalanceA
    let contractBalanceB
    let contractBalanceC
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      await dummyERC1155.mint(accounts[0], tokenIdA, depositAmountA)
      await dummyERC1155.mint(accounts[0], tokenIdB, depositAmountB)
      await dummyERC1155.mint(accounts[0], tokenIdC, depositAmountC)
      accountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      accountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      accountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      erc1155PredicateAddress = contracts.root.erc1155Predicate.target
      contractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      contractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      contractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC1155.setApprovalForAll(erc1155PredicateAddress, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      const newAccountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      const newAccountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      expect(newAccountBalanceA).to.equal(accountBalanceA - depositAmountA)
      expect(newAccountBalanceB).to.equal(accountBalanceB - depositAmountB)
      expect(newAccountBalanceC).to.equal(accountBalanceC - depositAmountC)
      // update account balance
      accountBalanceA = newAccountBalanceA
      accountBalanceB = newAccountBalanceB
      accountBalanceC = newAccountBalanceC
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      expect(newContractBalanceA).to.equal(contractBalanceA + depositAmountA)
      expect(newContractBalanceB).to.equal(contractBalanceB + depositAmountB)
      expect(newContractBalanceC).to.equal(contractBalanceC + depositAmountC)
      // update balance
      contractBalanceA = newContractBalanceA
      contractBalanceB = newContractBalanceB
      contractBalanceC = newContractBalanceC
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC1155.connect(await ethers.getSigner(depositReceiver))
        .withdrawBatch([tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC1155, 'TransferBatch')
        .withArgs(depositReceiver, mockValues.zeroAddress, [tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.reverted
    })

    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data)
      expect(exitTx).to.exist
    })

    it('start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(depositReceiver)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'TransferBatch')
        .withArgs(mockValues.zeroAddress, depositReceiver, [tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(depositReceiver, tokenIdA)
      const newAccountBalanceB = await dummyERC1155.balanceOf(depositReceiver, tokenIdB)
      const newAccountBalanceC = await dummyERC1155.balanceOf(depositReceiver, tokenIdC)
      expect(newAccountBalanceA).to.equal(accountBalanceA + withdrawAmountA)
      expect(newAccountBalanceB).to.equal(accountBalanceB + withdrawAmountB)
      expect(newAccountBalanceC).to.equal(accountBalanceC + withdrawAmountC)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      expect(newContractBalanceA).to.equal(contractBalanceA - withdrawAmountA)
      expect(newContractBalanceB).to.equal(contractBalanceB - withdrawAmountB)
      expect(newContractBalanceC).to.equal(contractBalanceC - withdrawAmountC)
    })
  })

  describe('Withdraw batch ERC1155 :: non-deposit account', async () => {
    let erc1155PredicateAddress
    const withdrawAmountA = mockValues.amounts[2]
    const withdrawAmountB = mockValues.amounts[2]
    const withdrawAmountC = mockValues.amounts[1]
    const depositAmountA = withdrawAmountA + mockValues.amounts[0]
    const depositAmountB = withdrawAmountA + mockValues.amounts[9]
    const depositAmountC = withdrawAmountA + mockValues.amounts[6]
    const tokenIdA = mockValues.numbers[4]
    const tokenIdB = mockValues.numbers[5]
    const tokenIdC = mockValues.numbers[8]
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = constructERC1155DepositData(
      [tokenIdA, tokenIdB, tokenIdC],
      [depositAmountA, depositAmountB, depositAmountC]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalanceA
    let accountBalanceB
    let accountBalanceC
    let contractBalanceA
    let contractBalanceB
    let contractBalanceC
    let withdrawTx
    let withdrawTxReceipt
    let checkpointData
    let headerNumber
    let exitTx

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      await dummyERC1155.mint(accounts[0], tokenIdA, depositAmountA)
      await dummyERC1155.mint(accounts[0], tokenIdB, depositAmountB)
      await dummyERC1155.mint(accounts[0], tokenIdC, depositAmountC)
      accountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      accountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      accountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      erc1155PredicateAddress = contracts.root.erc1155Predicate.target
      contractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      contractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      contractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
    })

    it('Depositor should be able to approve and deposit', async () => {
      await dummyERC1155.setApprovalForAll(erc1155PredicateAddress, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Deposit amount should be deducted from depositor account', async () => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      const newAccountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      const newAccountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      expect(newAccountBalanceA).to.equal(accountBalanceA - depositAmountA)
      expect(newAccountBalanceB).to.equal(accountBalanceB - depositAmountB)
      expect(newAccountBalanceC).to.equal(accountBalanceC - depositAmountC)
      // update account balance
      accountBalanceA = newAccountBalanceA
      accountBalanceB = newAccountBalanceB
      accountBalanceC = newAccountBalanceC
    })

    it('Deposit amount should be credited to correct contract', async () => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      expect(newContractBalanceA).to.equal(contractBalanceA + depositAmountA)
      expect(newContractBalanceB).to.equal(contractBalanceB + depositAmountB)
      expect(newContractBalanceC).to.equal(contractBalanceC + depositAmountC)
      // update balance
      contractBalanceA = newContractBalanceA
      contractBalanceB = newContractBalanceB
      contractBalanceC = newContractBalanceC
    })

    it('Can receive withdraw tx', async () => {
      withdrawTx = await contracts.child.dummyERC1155.connect(await ethers.getSigner(depositReceiver))
        .withdrawBatch([tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
      expect(withdrawTx).to.exist
      await withdrawTx.wait()
      withdrawTxReceipt = await web3.eth.getTransactionReceipt(withdrawTx.hash)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      expect(withdrawTx)
        .to.emit(contracts.child.dummyERC1155, 'TransferBatch')
        .withArgs(depositReceiver, mockValues.zeroAddress, [tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
    })

    it('Should submit checkpoint', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTxReceipt)
      expect(checkpointData).to.exist
    })

    it('Should match checkpoint details', async () => {
      const root = bufferToHex(checkpointData.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      expect(root).to.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, '')
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async () => {
      const dummyReceipt = getFakeReceiptBytes(withdrawTxReceipt, mockValues.bytes32[4])
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(dummyReceipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.reverted
    })

    it('Should start exit', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      exitTx = await contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data)
      expect(exitTx).to.exist
    })

    it('start exit again', async () => {
      const logIndex = 0
      const data = bufferToHex(
        rlp.encode([
          headerNumber,
          bufferToHex(Buffer.concat(checkpointData.proof)),
          checkpointData.number,
          checkpointData.timestamp,
          bufferToHex(checkpointData.transactionsRoot),
          bufferToHex(checkpointData.receiptsRoot),
          bufferToHex(checkpointData.receipt),
          bufferToHex(rlp.encode(checkpointData.receiptParentNodes)),
          bufferToHex(checkpointData.path),
          logIndex
        ])
      )
      await expect(contracts.root.rootChainManager.connect(await ethers.getSigner(nonDepositAccount)).exit(data))
        .to.be.revertedWith('RootChainManager: EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      expect(exitTx)
        .to.emit(contracts.root.rootChainManager, 'TransferBatch')
        .withArgs(mockValues.zeroAddress, depositReceiver, [tokenIdA, tokenIdB, tokenIdC], [withdrawAmountA, withdrawAmountB, withdrawAmountC])
    })

    it('Should have more amount in withdrawer account after withdraw', async () => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(depositReceiver, tokenIdA)
      const newAccountBalanceB = await dummyERC1155.balanceOf(depositReceiver, tokenIdB)
      const newAccountBalanceC = await dummyERC1155.balanceOf(depositReceiver, tokenIdC)
      expect(newAccountBalanceA).to.equal(accountBalanceA + withdrawAmountA)
      expect(newAccountBalanceB).to.equal(accountBalanceB + withdrawAmountB)
      expect(newAccountBalanceC).to.equal(accountBalanceC + withdrawAmountC)
    })

    it('Should have less amount in predicate contract after withdraw', async () => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      expect(newContractBalanceA).to.equal(contractBalanceA - withdrawAmountA)
      expect(newContractBalanceB).to.equal(contractBalanceB - withdrawAmountB)
      expect(newContractBalanceC).to.equal(contractBalanceC - withdrawAmountC)
    })
  })

  /**
   * Alice has token on child chain
   * Alice withdraws this token to root chain
   * Alice deposits token to child chain for self
   * Alice transfers it to Bob on child chain
   * Bob withdraws the token to root chain
   * Bob transfers this token to Charlie on root chain
   * Charlie deposits token to child chain for Daniel
   */
  describe('Withdraw MintableERC721', () => {
    const admin = accounts[0]
    const alice = accounts[0]
    const bob = accounts[1]
    const charlie = accounts[2]
    const daniel = accounts[3]
    const tokenId = mockValues.numbers[3]
    let contracts
    let rootChainManager
    let rootMintableERC721
    let childMintableERC721
    let mintableERC721Predicate
    let checkpointManager
    let burnTx1
    let burnTx2
    let burnTx1Receipt
    let burnTx2Receipt
    let checkpointData1
    let checkpointData2
    let headerNumber1
    let headerNumber2
    let exitTx1
    let exitTx2

    before(async () => {
      contracts = await deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      rootMintableERC721 = contracts.root.dummyMintableERC721
      childMintableERC721 = contracts.child.dummyMintableERC721
      mintableERC721Predicate = contracts.root.mintableERC721Predicate
      checkpointManager = contracts.root.checkpointManager
      await childMintableERC721.connect(await ethers.getSigner(admin)).mint(alice, tokenId)
    })

    it('Alice should have token on child chain', async () => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(alice)
    })

    it('Token should not exist on root chain', async () => {
      await expect(rootMintableERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('Alice should be able to send burn tx', async () => {
      burnTx1 = await childMintableERC721.connect(await ethers.getSigner(alice)).withdraw(tokenId)
      expect(burnTx1).to.exist
      await burnTx1.wait()
      burnTx1Receipt = await web3.eth.getTransactionReceipt(burnTx1.hash)
    })

    it('Token should be burned on child chain', async () => {
      await expect(childMintableERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('Checkpoint should be submitted', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData1 = await submitCheckpoint(checkpointManager, burnTx1Receipt)
      expect(checkpointData1).to.exist
    })

    it('Checkpoint details should match', async () => {
      const root = bufferToHex(checkpointData1.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber1 = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber1).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber1)
      expect(root).to.equal(headerData.root)
    })

    it('Alice should be able to send exit tx', async () => {
      const logIndex = burnTx1Receipt.logs.findIndex(log => log.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase())
      const data = bufferToHex(
        rlp.encode([
          headerNumber1,
          bufferToHex(Buffer.concat(checkpointData1.proof)),
          checkpointData1.number,
          checkpointData1.timestamp,
          bufferToHex(checkpointData1.transactionsRoot),
          bufferToHex(checkpointData1.receiptsRoot),
          bufferToHex(checkpointData1.receipt),
          bufferToHex(rlp.encode(checkpointData1.receiptParentNodes)),
          bufferToHex(checkpointData1.path),
          logIndex
        ])
      )
      exitTx1 = await contracts.root.rootChainManager.connect(await ethers.getSigner(alice)).exit(data)
      expect(exitTx1).to.exist
    })

    it('Token should be minted for Alice on root chain', async () => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(alice)
    })

    it('Alice should be able to deposit token', async () => {
      await rootMintableERC721.connect(await ethers.getSigner(alice)).approve(mintableERC721Predicate.target, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId.toString()])
      const depositTx = await rootChainManager.connect(await ethers.getSigner(alice)).depositFor(alice, rootMintableERC721.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Token should be transferred to predicate on root chain', async () => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(mintableERC721Predicate.target)
    })

    it('Token should be minted for Alice on child chain', async () => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(alice)
    })

    it('Alice should transfer token to bob', async () => {
      await childMintableERC721.connect(await ethers.getSigner(alice)).transferFrom(alice, bob, tokenId)
      const owner = await childMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(bob)
    })

    it('Bob should be able to burn token', async () => {
      burnTx2 = await childMintableERC721.connect(await ethers.getSigner(bob)).withdraw(tokenId)
      expect(burnTx2).to.exist
      await burnTx2.wait()
      burnTx2Receipt = await web3.eth.getTransactionReceipt(burnTx2.hash)
    })

    it('Token should be burned on child chain', async () => {
      await expect(childMintableERC721.ownerOf(tokenId)).to.be.revertedWith('ERC721: owner query for nonexistent token')
    })

    it('checkpoint should be submitted', async () => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData2 = await submitCheckpoint(checkpointManager, burnTx2Receipt)
      expect(checkpointData2).to.exist
    })

    it('checkpoint details should match', async () => {
      const root = bufferToHex(checkpointData2.header.root)
      expect(root).to.exist

      // fetch latest header number
      headerNumber2 = await contracts.root.checkpointManager.currentCheckpointNumber()
      expect(headerNumber2).to.be.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber2)
      expect(root).to.equal(headerData.root)
    })

    it('bob should be able to exit token', async () => {
      const logIndex = burnTx2Receipt.logs.findIndex(log => log.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase())
      const data = bufferToHex(
        rlp.encode([
          headerNumber2,
          bufferToHex(Buffer.concat(checkpointData2.proof)),
          checkpointData2.number,
          checkpointData2.timestamp,
          bufferToHex(checkpointData2.transactionsRoot),
          bufferToHex(checkpointData2.receiptsRoot),
          bufferToHex(checkpointData2.receipt),
          bufferToHex(rlp.encode(checkpointData2.receiptParentNodes)),
          bufferToHex(checkpointData2.path),
          logIndex
        ])
      )
      exitTx2 = await contracts.root.rootChainManager.connect(await ethers.getSigner(bob)).exit(data)
      expect(exitTx2).to.exist
    })

    it('Token should be transferred to Bob on root chain', async () => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(bob)
    })

    it('Bob should transfer token to Charlie', async () => {
      await rootMintableERC721.connect(await ethers.getSigner(bob)).transferFrom(bob, charlie, tokenId)
      const owner = await rootMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(charlie)
    })

    it('Charlie should be able to deposit token for Daniel', async () => {
      await rootMintableERC721.connect(await ethers.getSigner(charlie)).approve(mintableERC721Predicate.target, tokenId)
      const depositData = abi.encode(['uint256'], [tokenId.toString()])
      const depositTx = await rootChainManager.connect(await ethers.getSigner(charlie)).depositFor(daniel, rootMintableERC721.target, depositData)
      expect(depositTx).to.exist
      const txReceipt = await depositTx.wait()
      const syncTx = await syncState(txReceipt)
      expect(syncTx).to.exist
    })

    it('Token should be transferred to predicate on root chain', async () => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(mintableERC721Predicate.target)
    })

    it('Token should be minted for Daniel on child chain', async () => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      expect(owner).to.equal(daniel)
    })
  })
})
