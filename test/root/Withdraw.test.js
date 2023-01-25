import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { expectRevert } from '@openzeppelin/test-helpers'
import { bufferToHex, rlp, toBuffer } from 'ethereumjs-util'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import contracts, { childWeb3, rootWeb3 as web3 } from '../helpers/contracts'
import logDecoder from '../helpers/log-decoder'
import { submitCheckpoint } from '../helpers/checkpoint'
import { getFakeReceiptBytes, getDiffEncodedReceipt } from '../helpers/proofs'
import { constructERC1155DepositData, syncState } from '../helpers/utils'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

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

contract('RootChainManager', async(accounts) => {
  describe('Withdraw ERC20', async() => {
    const depositAmount = mockValues.amounts[1]
    let totalDepositedAmount = new BN('0')
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let dummyERC20
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      accountBalance = await dummyERC20.balanceOf(accounts[0])
      contractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC20.approve(contracts.root.erc20Predicate.address, depositAmount)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC20.address, depositData)
      should.exist(depositTx)
      totalDepositedAmount = totalDepositedAmount.add(depositAmount)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Second depositor should be able to approve and deposit', async() => {
      await dummyERC20.mint(depositAmount)
      await dummyERC20.transfer(accounts[2], depositAmount)
      await dummyERC20.approve(contracts.root.erc20Predicate.address, mockValues.amounts[2], { from: accounts[2] })
      const depositTx = await rootChainManager.depositFor(accounts[2], dummyERC20.address, depositData, { from: accounts[2] })
      should.exist(depositTx)
      totalDepositedAmount = totalDepositedAmount.add(depositAmount)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )
      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(totalDepositedAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC20.withdraw(withdrawAmount, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'revert')
    })

    it('Should fail to start exit (changed the block number to future block)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'Leaf index is too big')
    })

    it('Should fail to start exit (changed the block number with different encoding)', async() => {
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
      await expectRevert.unspecified(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }))
    })

    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data, { from: depositReceiver })
      should.exist(exitTx)
    })

    it('Should fail: exit with a differently encoded amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getDiffEncodedReceipt(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail: start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'Transfer')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw ERC20 :: non-deposit account', async() => {
    const depositAmount = mockValues.amounts[1]
    let totalDepositedAmount = new BN('0')
    const withdrawAmount = mockValues.amounts[1]
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let dummyERC20
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC20 = contracts.root.dummyERC20
      rootChainManager = contracts.root.rootChainManager
      accountBalance = await dummyERC20.balanceOf(accounts[0])
      contractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC20.approve(contracts.root.erc20Predicate.address, depositAmount)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC20.address, depositData)
      should.exist(depositTx)
      totalDepositedAmount = totalDepositedAmount.add(depositAmount)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Second depositor should be able to approve and deposit', async() => {
      await dummyERC20.mint(depositAmount)
      await dummyERC20.transfer(accounts[2], depositAmount)
      await dummyERC20.approve(contracts.root.erc20Predicate.address, mockValues.amounts[2], { from: accounts[2] })
      const depositTx = await rootChainManager.depositFor(accounts[2], dummyERC20.address, depositData, { from: accounts[2] })
      should.exist(depositTx)
      totalDepositedAmount = totalDepositedAmount.add(depositAmount)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )
      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(totalDepositedAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC20.withdraw(withdrawAmount, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'revert')
    })

    it('Should fail to start exit (changed the block number to future block)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'Leaf index is too big')
    })

    it('Should fail to start exit (changed the block number with different encoding)', async() => {
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
      await expectRevert.unspecified(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }))
    })

    // call exit from some account other than depositReceiver
    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data, { from: nonDepositAccount })
      should.exist(exitTx)
    })

    it('Should fail: exit with a differently encoded amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getDiffEncodedReceipt(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail: start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'Transfer')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC20.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC20.balanceOf(contracts.root.erc20Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw ERC721', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = new BN('1')
    const withdrawAmount = new BN('1')
    const depositReceiver = accounts[0]
    const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
    let contracts
    let dummyERC721
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(depositTokenId)
      accountBalance = await dummyERC721.balanceOf(accounts[0])
      contractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC721.approve(contracts.root.erc721Predicate.address, depositTokenId)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC721.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC721.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(depositAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC721.withdraw(depositTokenId, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'revert')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'revert')
    })

    it('Should fail to start exit (changed the block number)', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'Leaf index is too big')
    })

    it('Should start exit', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      exitTx = await contracts.root.rootChainManager.exit(data, { from: depositReceiver })
      should.exist(exitTx)
    })

    it('Should fail: start exit again', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'Transfer')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC721.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw batch ERC721', async() => {
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
    let checkpointData
    let headerNumber
    let exitTx1
    let exitTx2
    let exitTx3

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      rootToken = contracts.root.dummyERC721
      childToken = contracts.child.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      checkpointManager = contracts.root.checkpointManager
      erc721Predicate = contracts.root.erc721Predicate
      await rootToken.mint(tokenId1)
      await rootToken.mint(tokenId2)
      await rootToken.mint(tokenId3)
    })

    it('User should own tokens on root chain', async() => {
      {
        const owner = await rootToken.ownerOf(tokenId1)
        owner.should.equal(user)
      }
      {
        const owner = await rootToken.ownerOf(tokenId2)
        owner.should.equal(user)
      }
      {
        const owner = await rootToken.ownerOf(tokenId3)
        owner.should.equal(user)
      }
    })

    it('Tokens should not exist on child chain', async() => {
      await expectRevert(childToken.ownerOf(tokenId1), 'ERC721: owner query for nonexistent token')
      await expectRevert(childToken.ownerOf(tokenId2), 'ERC721: owner query for nonexistent token')
      await expectRevert(childToken.ownerOf(tokenId3), 'ERC721: owner query for nonexistent token')
    })

    it('User should be able to approve and deposit', async() => {
      await rootToken.setApprovalForAll(erc721Predicate.address, true)
      const depositTx = await rootChainManager.depositFor(user, rootToken.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Predicate should own tokens on root chain', async() => {
      {
        const owner = await rootToken.ownerOf(tokenId1)
        owner.should.equal(erc721Predicate.address)
      }
      {
        const owner = await rootToken.ownerOf(tokenId2)
        owner.should.equal(erc721Predicate.address)
      }
      {
        const owner = await rootToken.ownerOf(tokenId3)
        owner.should.equal(erc721Predicate.address)
      }
    })

    it('User should own tokens on child chain', async() => {
      {
        const owner = await childToken.ownerOf(tokenId1)
        owner.should.equal(user)
      }
      {
        const owner = await childToken.ownerOf(tokenId2)
        owner.should.equal(user)
      }
      {
        const owner = await childToken.ownerOf(tokenId3)
        owner.should.equal(user)
      }
    })

    it('User should be able to start withdraw', async() => {
      withdrawTx = await childToken.withdrawBatch([tokenId1, tokenId2, tokenId3])
      should.exist(withdrawTx)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('User should fail to exit with WithdrawnBatch', async() => {
      const logIndex = withdrawTx.receipt.rawLogs
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // attempt exit, but fail due to mismatching event signature
      // read PR description of https://github.com/maticnetwork/pos-portal-private/pull/1
      await expectRevert(contracts.root.rootChainManager.exit(data, { from: user }), 'ERC721Predicate: INVALID_SIGNATURE')
    })

    it('User should be able to exit tokenId1 with Transfer', async() => {
      const logIndices = []
      withdrawTx.receipt.rawLogs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      chai.assert(logIndices.length == 3, 'three tokens were burnt !')

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
          logIndices[0]
        ])
      )
      // start exit, must go through
      exitTx1 = contracts.root.rootChainManager.exit(data, { from: user })
      should.exist(exitTx1)
    })

    it('User should own tokenId1 on root chain', async() => {
      const owner = await rootToken.ownerOf(tokenId1)
      owner.should.equal(user)
    })

    it('User should be able to exit tokenId2 with Transfer', async() => {
      const logIndices = []
      withdrawTx.receipt.rawLogs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      chai.assert(logIndices.length == 3, 'three tokens were burnt !')

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
          logIndices[1]
        ])
      )
      // start exit, must go through
      exitTx2 = contracts.root.rootChainManager.exit(data, { from: user })
      should.exist(exitTx2)
    })

    it('User should own tokenId2 on root chain', async() => {
      const owner = await rootToken.ownerOf(tokenId2)
      owner.should.equal(user)
    })

    it('User should be able to exit tokenId3 with Transfer', async() => {
      const logIndices = []
      withdrawTx.receipt.rawLogs.forEach((e, i) => {
        if (e.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase()) {
          logIndices.push(i)
        }
      })
      chai.assert(logIndices.length == 3, 'three tokens were burnt !')

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
          logIndices[2]
        ])
      )
      // start exit, must go through
      exitTx3 = contracts.root.rootChainManager.exit(data, { from: user })
      should.exist(exitTx3)
    })

    it('User should own tokenId3 on root chain', async() => {
      const owner = await rootToken.ownerOf(tokenId3)
      owner.should.equal(user)
    })

    it('Tokens should not exist on child chain', async() => {
      await expectRevert(childToken.ownerOf(tokenId1), 'ERC721: owner query for nonexistent token')
      await expectRevert(childToken.ownerOf(tokenId2), 'ERC721: owner query for nonexistent token')
      await expectRevert(childToken.ownerOf(tokenId3), 'ERC721: owner query for nonexistent token')
    })
  })

  describe('Withdraw ERC721 :: non-deposit account', async() => {
    const depositTokenId = mockValues.numbers[4]
    const depositAmount = new BN('1')
    const withdrawAmount = new BN('1')
    const depositReceiver = accounts[0]
    const nonDepositAccount = accounts[1]
    const depositData = abi.encode(['uint256'], [depositTokenId.toString()])
    let contracts
    let dummyERC721
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC721 = contracts.root.dummyERC721
      rootChainManager = contracts.root.rootChainManager
      await dummyERC721.mint(depositTokenId)
      accountBalance = await dummyERC721.balanceOf(accounts[0])
      contractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC721.approve(contracts.root.erc721Predicate.address, depositTokenId)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC721.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC721.balanceOf(accounts[0])
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(depositAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC721.withdraw(depositTokenId, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'revert')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'revert')
    })

    it('Should fail to start exit (changed the block number)', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'Leaf index is too big')
    })

    it('Should start exit', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit from non deposit receiver
      exitTx = await contracts.root.rootChainManager.exit(data, { from: nonDepositAccount })
      should.exist(exitTx)
    })

    it('Should fail: start exit again', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
          bufferToHex(checkpointData.path), // branch mask,
          logIndex
        ])
      )
      // start exit
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'Transfer')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC721.balanceOf(depositReceiver)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC721.balanceOf(contracts.root.erc721Predicate.address)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw single ERC1155', async() => {
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
        ['0x0']
      ]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      const mintAmount = depositAmount.add(mockValues.amounts[2])
      await dummyERC1155.mint(accounts[0], tokenId, mintAmount)
      accountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      contractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.address, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(depositAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC1155.withdrawSingle(tokenId, withdrawAmount, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'TransferSingle')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'revert')
    })

    it('Should fail to start exit (changed the block number)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'Leaf index is too big')
    })

    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data,
        { from: depositReceiver })
      should.exist(exitTx)
    })

    it('Should fail: start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'TransferSingle')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositReceiver, tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw single ERC1155 :: non-deposit account', async() => {
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
        ['0x0']
      ]
    )
    let contracts
    let dummyERC1155
    let rootChainManager
    let accountBalance
    let contractBalance
    let transferLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      const mintAmount = depositAmount.add(mockValues.amounts[2])
      await dummyERC1155.mint(accounts[0], tokenId, mintAmount)
      accountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      contractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.address, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(accounts[0], tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.sub(depositAmount)
      )

      // update account balance
      accountBalance = newAccountBalance
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.add(depositAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC1155.withdrawSingle(tokenId, withdrawAmount, { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'TransferSingle')
      should.exist(transferLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'revert')
    })

    it('Should fail to start exit (changed the block number)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'Leaf index is too big')
    })

    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount })
      should.exist(exitTx)
    })

    it('Should fail: start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should fail to start exit again (change the log index to generate same exit hash)', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'TransferSingle')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalance = await dummyERC1155.balanceOf(depositReceiver, tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        accountBalance.add(depositAmount)
      )
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalance = await dummyERC1155.balanceOf(contracts.root.erc1155Predicate.address, tokenId)
      newContractBalance.should.be.a.bignumber.that.equals(
        contractBalance.sub(withdrawAmount)
      )
    })
  })

  describe('Withdraw batch ERC1155', async() => {
    let erc1155PredicateAddress
    const withdrawAmountA = mockValues.amounts[2]
    const withdrawAmountB = mockValues.amounts[2]
    const withdrawAmountC = mockValues.amounts[1]
    const depositAmountA = withdrawAmountA.add(mockValues.amounts[0])
    const depositAmountB = withdrawAmountA.add(mockValues.amounts[9])
    const depositAmountC = withdrawAmountA.add(mockValues.amounts[6])
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
    let transferBatchLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx
    let logs

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      await dummyERC1155.mint(accounts[0], tokenIdA, depositAmountA)
      await dummyERC1155.mint(accounts[0], tokenIdB, depositAmountB)
      await dummyERC1155.mint(accounts[0], tokenIdC, depositAmountC)
      accountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      erc1155PredicateAddress = contracts.root.erc1155Predicate.address
      contractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      accountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      contractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      accountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      contractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.address, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      newAccountBalanceA.should.be.a.bignumber.that.equals(
        accountBalanceA.sub(depositAmountA)
      )
      const newAccountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      newAccountBalanceB.should.be.a.bignumber.that.equals(
        accountBalanceB.sub(depositAmountB)
      )
      const newAccountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      newAccountBalanceC.should.be.a.bignumber.that.equals(
        accountBalanceC.sub(depositAmountC)
      )
      // update account balance
      accountBalanceA = newAccountBalanceA
      accountBalanceB = newAccountBalanceB
      accountBalanceC = newAccountBalanceC
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      newContractBalanceA.should.be.a.bignumber.that.equals(
        contractBalanceA.add(depositAmountA)
      )
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      newContractBalanceB.should.be.a.bignumber.that.equals(
        contractBalanceB.add(depositAmountB)
      )
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      newContractBalanceC.should.be.a.bignumber.that.equals(
        contractBalanceC.add(depositAmountC)
      )
      // update balance
      contractBalanceA = newContractBalanceA
      contractBalanceB = newContractBalanceB
      contractBalanceC = newContractBalanceC
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC1155.withdrawBatch(
        [tokenIdA, tokenIdB, tokenIdC],
        [withdrawAmountA, withdrawAmountB, withdrawAmountC],
        { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferBatchLog = logs.find(l => l.event === 'TransferBatch')
      should.exist(transferBatchLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'revert')
    })

    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data,
        { from: depositReceiver })
      should.exist(exitTx)
    })

    it('start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: depositReceiver }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'TransferBatch')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(depositReceiver, tokenIdA)
      newAccountBalanceA.should.be.a.bignumber.that.equals(accountBalanceA.add(withdrawAmountA))
      const newAccountBalanceB = await dummyERC1155.balanceOf(depositReceiver, tokenIdB)
      newAccountBalanceB.should.be.a.bignumber.that.equals(accountBalanceB.add(withdrawAmountB))
      const newAccountBalanceC = await dummyERC1155.balanceOf(depositReceiver, tokenIdC)
      newAccountBalanceC.should.be.a.bignumber.that.equals(accountBalanceC.add(withdrawAmountC))
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      newContractBalanceA.should.be.a.bignumber.that.equals(
        contractBalanceA.sub(withdrawAmountA)
      )
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      newContractBalanceB.should.be.a.bignumber.that.equals(
        contractBalanceB.sub(withdrawAmountB)
      )
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      newContractBalanceC.should.be.a.bignumber.that.equals(
        contractBalanceC.sub(withdrawAmountC)
      )
    })
  })

  describe('Withdraw batch ERC1155 :: non-deposit account', async() => {
    let erc1155PredicateAddress
    const withdrawAmountA = mockValues.amounts[2]
    const withdrawAmountB = mockValues.amounts[2]
    const withdrawAmountC = mockValues.amounts[1]
    const depositAmountA = withdrawAmountA.add(mockValues.amounts[0])
    const depositAmountB = withdrawAmountA.add(mockValues.amounts[9])
    const depositAmountC = withdrawAmountA.add(mockValues.amounts[6])
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
    let transferBatchLog
    let withdrawTx
    let checkpointData
    let headerNumber
    let exitTx
    let logs

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      dummyERC1155 = contracts.root.dummyERC1155
      rootChainManager = contracts.root.rootChainManager
      await dummyERC1155.mint(accounts[0], tokenIdA, depositAmountA)
      await dummyERC1155.mint(accounts[0], tokenIdB, depositAmountB)
      await dummyERC1155.mint(accounts[0], tokenIdC, depositAmountC)
      accountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      erc1155PredicateAddress = contracts.root.erc1155Predicate.address
      contractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      accountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      contractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      accountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      contractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
    })

    it('Depositor should be able to approve and deposit', async() => {
      await dummyERC1155.setApprovalForAll(contracts.root.erc1155Predicate.address, true)
      const depositTx = await rootChainManager.depositFor(depositReceiver, dummyERC1155.address, depositData)
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Deposit amount should be deducted from depositor account', async() => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(accounts[0], tokenIdA)
      newAccountBalanceA.should.be.a.bignumber.that.equals(
        accountBalanceA.sub(depositAmountA)
      )
      const newAccountBalanceB = await dummyERC1155.balanceOf(accounts[0], tokenIdB)
      newAccountBalanceB.should.be.a.bignumber.that.equals(
        accountBalanceB.sub(depositAmountB)
      )
      const newAccountBalanceC = await dummyERC1155.balanceOf(accounts[0], tokenIdC)
      newAccountBalanceC.should.be.a.bignumber.that.equals(
        accountBalanceC.sub(depositAmountC)
      )
      // update account balance
      accountBalanceA = newAccountBalanceA
      accountBalanceB = newAccountBalanceB
      accountBalanceC = newAccountBalanceC
    })

    it('Deposit amount should be credited to correct contract', async() => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      newContractBalanceA.should.be.a.bignumber.that.equals(
        contractBalanceA.add(depositAmountA)
      )
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      newContractBalanceB.should.be.a.bignumber.that.equals(
        contractBalanceB.add(depositAmountB)
      )
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      newContractBalanceC.should.be.a.bignumber.that.equals(
        contractBalanceC.add(depositAmountC)
      )
      // update balance
      contractBalanceA = newContractBalanceA
      contractBalanceB = newContractBalanceB
      contractBalanceC = newContractBalanceC
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.child.dummyERC1155.withdrawBatch(
        [tokenIdA, tokenIdB, tokenIdC],
        [withdrawAmountA, withdrawAmountB, withdrawAmountC],
        { from: depositReceiver })
      should.exist(withdrawTx)
    })

    it('Should emit Transfer log in withdraw tx', () => {
      logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferBatchLog = logs.find(l => l.event === 'TransferBatch')
      should.exist(transferBatchLog)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(contracts.root.checkpointManager, withdrawTx.receipt)
      should.exist(checkpointData)
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })

    it('Should fail: exit with a random data receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, '')
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'RootChainManager: INVALID_PROOF')
    })

    it('Should fail: exit with a fake amount data in receipt', async() => {
      const receipt = await childWeb3.eth.getTransactionReceipt(
        withdrawTx.receipt.transactionHash)
      const dummyReceipt = getFakeReceiptBytes(receipt, mockValues.bytes32[4])
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'revert')
    })

    it('Should start exit', async() => {
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
      exitTx = await contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount })
      should.exist(exitTx)
    })

    it('start exit again', async() => {
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
      await expectRevert(contracts.root.rootChainManager.exit(data,
        { from: nonDepositAccount }), 'EXIT_ALREADY_PROCESSED')
    })

    it('Should emit Transfer log in exit tx', () => {
      const logs = logDecoder.decodeLogs(exitTx.receipt.rawLogs)
      const exitTransferLog = logs.find(l => l.event === 'TransferBatch')
      should.exist(exitTransferLog)
    })

    it('Should have more amount in withdrawer account after withdraw', async() => {
      const newAccountBalanceA = await dummyERC1155.balanceOf(depositReceiver, tokenIdA)
      newAccountBalanceA.should.be.a.bignumber.that.equals(accountBalanceA.add(withdrawAmountA))
      const newAccountBalanceB = await dummyERC1155.balanceOf(depositReceiver, tokenIdB)
      newAccountBalanceB.should.be.a.bignumber.that.equals(accountBalanceB.add(withdrawAmountB))
      const newAccountBalanceC = await dummyERC1155.balanceOf(depositReceiver, tokenIdC)
      newAccountBalanceC.should.be.a.bignumber.that.equals(accountBalanceC.add(withdrawAmountC))
    })

    it('Should have less amount in predicate contract after withdraw', async() => {
      const newContractBalanceA = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdA)
      newContractBalanceA.should.be.a.bignumber.that.equals(
        contractBalanceA.sub(withdrawAmountA)
      )
      const newContractBalanceB = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdB)
      newContractBalanceB.should.be.a.bignumber.that.equals(
        contractBalanceB.sub(withdrawAmountB)
      )
      const newContractBalanceC = await dummyERC1155.balanceOf(erc1155PredicateAddress, tokenIdC)
      newContractBalanceC.should.be.a.bignumber.that.equals(
        contractBalanceC.sub(withdrawAmountC)
      )
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
    let checkpointData1
    let checkpointData2
    let headerNumber1
    let headerNumber2

    before(async() => {
      contracts = await deployer.deployInitializedContracts(accounts)
      rootChainManager = contracts.root.rootChainManager
      rootMintableERC721 = contracts.root.dummyMintableERC721
      childMintableERC721 = contracts.child.dummyMintableERC721
      mintableERC721Predicate = contracts.root.mintableERC721Predicate
      checkpointManager = contracts.root.checkpointManager
      await childMintableERC721.mint(alice, tokenId, { from: admin })
    })

    it('Alice should have token on child chain', async() => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      owner.should.equal(alice)
    })

    it('Token should not exist on root chain', async() => {
      await expectRevert(rootMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('Alice should be able to send burn tx', async() => {
      burnTx1 = await childMintableERC721.withdraw(tokenId, { from: alice })
      should.exist(burnTx1)
    })

    it('Token should be burned on child chain', async() => {
      await expectRevert(childMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('Checkpoint should be submitted', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData1 = await submitCheckpoint(checkpointManager, burnTx1.receipt)
      should.exist(checkpointData1)
    })

    it('Checkpoint details should match', async() => {
      const root = bufferToHex(checkpointData1.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber1 = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber1.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber1)
      root.should.equal(headerData.root)
    })

    it('Alice should be able to send exit tx', async() => {
      const logIndex = burnTx1.receipt.rawLogs.findIndex(log => log.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase())
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
          bufferToHex(checkpointData1.path), // branch mask,
          logIndex
        ])
      )
      const exitTx = await contracts.root.rootChainManager.exit(data, { from: alice })
      should.exist(exitTx)
    })

    it('Token should be minted for Alice on root chain', async() => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      owner.should.equal(alice)
    })

    it('Alice should be able to deposit token', async() => {
      await rootMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: alice })
      const depositData = abi.encode(['uint256'], [tokenId.toString()])
      const depositTx = await rootChainManager.depositFor(alice, rootMintableERC721.address, depositData, { from: alice })
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Token should be transferred to predicate on root chain', async() => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      owner.should.equal(mintableERC721Predicate.address)
    })

    it('Token should be minted for Alice on child chain', async() => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      // const owner = await childMintableERC721.ownerOf(tokenId)
      // owner.should.equal(alice)
      owner.should.equal(alice)
    })

    it('Alice should transfer token to bob', async() => {
      await childMintableERC721.transferFrom(alice, bob, tokenId, { from: alice })
      const owner = await childMintableERC721.ownerOf(tokenId)
      owner.should.equal(bob)
    })

    it('Bob should be able to burn token', async() => {
      burnTx2 = await childMintableERC721.withdraw(tokenId, { from: bob })
      should.exist(burnTx2)
    })

    it('Token should be burned on child chain', async() => {
      await expectRevert(childMintableERC721.ownerOf(tokenId), 'ERC721: owner query for nonexistent token')
    })

    it('checkpoint should be submitted', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData2 = await submitCheckpoint(checkpointManager, burnTx2.receipt)
      should.exist(checkpointData2)
    })

    it('checkpoint details should match', async() => {
      const root = bufferToHex(checkpointData2.header.root)
      should.exist(root)

      // fetch latest header number
      headerNumber2 = await contracts.root.checkpointManager.currentCheckpointNumber()
      headerNumber2.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber2)
      root.should.equal(headerData.root)
    })

    it('bob should be able to exit token', async() => {
      const logIndex = burnTx1.receipt.rawLogs.findIndex(log => log.topics[0].toLowerCase() === ERC721_TRANSFER_EVENT_SIG.toLowerCase())
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
          bufferToHex(checkpointData2.path), // branch mask,
          logIndex
        ])
      )
      const exitTx = await contracts.root.rootChainManager.exit(data, { from: bob })
      should.exist(exitTx)
    })

    it('Token should be transferred to Bob on root chain', async() => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      owner.should.equal(bob)
    })

    it('Bob should transfer token to Charlie', async() => {
      await rootMintableERC721.transferFrom(bob, charlie, tokenId, { from: bob })
      const owner = await rootMintableERC721.ownerOf(tokenId)
      owner.should.equal(charlie)
    })

    it('Charlie should be able to deposit token for Daniel', async() => {
      await rootMintableERC721.approve(mintableERC721Predicate.address, tokenId, { from: charlie })
      const depositData = abi.encode(['uint256'], [tokenId.toString()])
      const depositTx = await rootChainManager.depositFor(daniel, rootMintableERC721.address, depositData, { from: charlie })
      should.exist(depositTx)
      const syncTx = await syncState({ tx: depositTx })
      should.exist(syncTx)
    })

    it('Token should be transferred to predicate on root chain', async() => {
      const owner = await rootMintableERC721.ownerOf(tokenId)
      owner.should.equal(mintableERC721Predicate.address)
    })

    it('Token should be minted for Daniel on child chain', async() => {
      const owner = await childMintableERC721.ownerOf(tokenId)
      owner.should.equal(daniel)
    })
  })
})
