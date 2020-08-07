import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { bufferToHex, rlp } from 'ethereumjs-util'

import { mockValues } from '../helpers/constants'
import { build as buildCheckpoint, buildFromList as buildCheckpointFromList } from '../helpers/checkpoint'
import contracts, { childWeb3 } from '../helpers/contracts'

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

const submitCheckpointForList = async(checkpointManager, receiptObjList) => {
  receiptObjList = receiptObjList.sort((a, b) => a.blockNumber - b.blockNumber)
  // const txHashList = receiptObjList.map(r => r.transactionHash)

  const eventList = await Promise.all(
    receiptObjList.map(async(receiptObj) => {
      const [tx, receipt, block] = await Promise.all([
        childWeb3.eth.getTransaction(receiptObj.transactionHash),
        childWeb3.eth.getTransactionReceipt(receiptObj.transactionHash),
        childWeb3.eth.getBlock(receiptObj.blockHash, true /* returnTransactionObjects */)
      ])
      return {
        tx,
        receipt,
        block
      }
    })
  )

  const checkpointData = await buildCheckpointFromList(eventList)
  const root = bufferToHex(checkpointData.header.root)

  // submit checkpoint including burn (withdraw) tx
  await checkpointManager.setCheckpoint(
    root,
    receiptObjList[0].blockNumber,
    receiptObjList[receiptObjList.length - 1].blockNumber
  )
  // return checkpoint data
  return checkpointData
}

contract.only('RootChainManager', (accounts) => {
  describe('submit checkpoint for single transaction', () => {
    const amount = mockValues.amounts[8]
    const user = mockValues.addresses[3]
    let checkpointManager
    let childERC20
    let tx
    let checkpointData
    before(async() => {
      checkpointManager = await contracts.MockCheckpointManager.new()
      childERC20 = await contracts.ChildERC20.new('Dummy ERC20', 'DERC20', 18, accounts[0])
    })

    it('Should be able to make transaction on child chain', async() => {
      tx = await childERC20.approve(user, amount)
      should.exist(tx)
    })

    it('Should submit checkpoint', async() => {
      // submit checkpoint including burn (withdraw) tx
      checkpointData = await submitCheckpoint(checkpointManager, tx.receipt)
      should.exist(checkpointData)
      console.log(checkpointData.path)
      console.log(bufferToHex(rlp.encode(checkpointData.path)))
    })

    it('Should match checkpoint details', async() => {
      const root = bufferToHex(checkpointData.header.root)
      should.exist(root)

      // fetch latest header number
      const headerNumber = await checkpointManager.currentCheckpointNumber()
      headerNumber.should.be.bignumber.gt('0')

      // fetch header block details and validate
      const headerData = await checkpointManager.headerBlocks(headerNumber)
      root.should.equal(headerData.root)
    })
  })

  describe.only('submit checkpoint for two transactions', () => {
    const amount1 = mockValues.amounts[8]
    const amount2 = mockValues.amounts[5]
    const user1 = mockValues.addresses[3]
    const user2 = mockValues.addresses[4]
    let checkpointManager
    let childERC20
    let tx1
    let tx2
    let checkpointData
    before(async() => {
      checkpointManager = await contracts.MockCheckpointManager.new()
      childERC20 = await contracts.ChildERC20.new('Dummy ERC20', 'DERC20', 18, accounts[0])
    })

    it('Should be able to make first transaction on child chain', async() => {
      tx1 = await childERC20.approve(user1, amount1)
      should.exist(tx1)
    })

    it('Should be able to make second transaction on child chain', async() => {
      tx2 = await childERC20.approve(user2, amount2)
      should.exist(tx2)
    })

    it('Should submit checkpoint', async() => {
      checkpointData = await submitCheckpointForList(checkpointManager, [tx1.receipt, tx2.receipt])
      should.exist(checkpointData)
    })
  })
})
