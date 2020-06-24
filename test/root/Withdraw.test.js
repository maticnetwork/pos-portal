import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { bufferToHex, rlp } from 'ethereumjs-util'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import { childWeb3 } from '../helpers/contracts'
import logDecoder from '../helpers/log-decoder'
import { build as buildCheckpoint } from '../helpers/checkpoint'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

// submit checkpoint
const submitCheckpoint = async(checkpointManager, receiptObj) => {
  const tx = await childWeb3.eth.getTransaction(receiptObj.transactionHash)
  const receipt = await childWeb3.eth.getTransactionReceipt(
    receiptObj.transactionHash
  )
  const block = await childWeb3.eth.getBlock(
    receipt.blockHash,
    true /* returnTransactionObjects */
  )
  const event = {
    tx,
    receipt,
    block
  }

  // build checkpoint
  const checkpointData = await buildCheckpoint(event)
  const root = bufferToHex(checkpointData.header.root)

  // submit checkpoint including burn (withdraw) tx
  await checkpointManager.setCheckpoint(root, block.number, block.number)

  // return checkpoint data
  return checkpointData
}

contract('RootChainManager', async(accounts) => {
  describe('Withdraw ERC20', async() => {
    const depositAmount = mockValues.amounts[1]
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
        contractBalance.add(depositAmount)
      )

      // update balance
      contractBalance = newContractBalance
    })

    it('Can receive deposit tx', async() => {
      const depositTx = await contracts.child.dummyERC20.deposit(depositReceiver, depositData)
      should.exist(depositTx)
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      const transferLog = logs.find(l => l.event === 'Transfer')
      should.exist(transferLog)
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
          bufferToHex(rlp.encode(checkpointData.path)), // branch mask,
          logIndex
        ])
      )

      // start exit
      await contracts.root.rootChainManager.exit(data, { from: depositReceiver })
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
})
