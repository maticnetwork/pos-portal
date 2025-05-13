import { AbiCoder } from 'ethers'
import { bufferToHex, rlp } from 'ethereumjs-util'
import { deployInitializedTunnelContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { submitCheckpoint } from '../helpers/checkpoint.js'

const abi = new AbiCoder()

contract('Tunnel', async (accounts) => {
  let contracts
  let testChildTunnel
  let checkpointData
  let messageSentTx
  let messageSentTxReceipt
  let headerNumber
  let receivedTx
  let testRootTunnel

  before(async () => {
    contracts = await deployInitializedTunnelContracts(accounts)
    testRootTunnel = contracts.root.testRootTunnel
    testChildTunnel = contracts.child.testChildTunnel

    const STATE_SYNCER_ROLE = await testChildTunnel.STATE_SYNCER_ROLE()
    await testChildTunnel.grantRole(STATE_SYNCER_ROLE, accounts[0])
  })

  it('should receive message on L2 with type1', async () => {
    const type1 = await testChildTunnel.TYPE1()
    const messageReceiveTx = await testChildTunnel.onStateReceive(0, abi.encode(['bytes32', 'uint256'], [type1, '4']))
    expect(messageReceiveTx).to.exist
    const n = await testChildTunnel.number()
    expect(n).to.equal(4)
  })

  it('should receive message on L2 with type2', async () => {
    const type2 = await testChildTunnel.TYPE2()
    const messageReceiveTx = await testChildTunnel.onStateReceive(0, abi.encode(['bytes32', 'uint256'], [type2, '1']))
    expect(messageReceiveTx).to.exist
    const n = await testChildTunnel.number()
    expect(n).to.equal(3)
  })

  it('should send message on L1', async () => {
    const n = await testChildTunnel.number()
    messageSentTx = await testChildTunnel.sendMessage(abi.encode(['uint256'], [n.toString()]))
    await messageSentTx.wait()
    expect(messageSentTx).to.exist
    messageSentTxReceipt = await web3.eth.getTransactionReceipt(messageSentTx.hash)
  })

  it('should submit checkpoint', async () => {
    // submit checkpoint including message tx
    checkpointData = await submitCheckpoint(contracts.root.checkpointManager, messageSentTxReceipt)
    expect(checkpointData).to.exist
  })

  it('should match checkpoint details', async () => {
    const root = bufferToHex(checkpointData.header.root)
    expect(root).to.exist

    // fetch latest header number
    headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
    expect(headerNumber).to.be.gt('0')

    // fetch header block details and validate
    const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
    expect(headerData.root).to.equal(root)
  })

  it('should be able to call receive message', async () => {
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

    // receive message
    receivedTx = await contracts.root.testRootTunnel.receiveMessage(data)
    expect(receivedTx).to.exist
  })

  it('should set state receiving message', async () => {
    const number = await contracts.root.testRootTunnel.receivedNumber()
    expect(number).to.be.equal('3')
  })

  it('should fail while receiveing same message again', async () => {
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

    await expect(contracts.root.testRootTunnel.receiveMessage(data)).to.be.revertedWith(
      'RootTunnel: EXIT_ALREADY_PROCESSED'
    )
  })
})
