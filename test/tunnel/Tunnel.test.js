import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
import { expectRevert } from '@openzeppelin/test-helpers'
import { bufferToHex, rlp } from 'ethereumjs-util'

import * as deployer from '../helpers/deployer'
// import { mockValues } from '../helpers/constants'
// import { childWeb3 } from '../helpers/contracts'
// import logDecoder from '../helpers/log-decoder'
import { submitCheckpoint } from '../helpers/checkpoint'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('Tunnel', async(accounts) => {
  let contracts
  let testRootTunnel
  let testChildTunnel
  let checkpointData
  let messageSentTx
  let headerNumber
  let receivedTx

  before(async() => {
    contracts = await deployer.deployInitializedTunnelContracts(accounts)
    testRootTunnel = contracts.root.testRootTunnel
    testChildTunnel = contracts.child.testChildTunnel

    const STATE_SYNCER_ROLE = await testChildTunnel.STATE_SYNCER_ROLE()
    await testChildTunnel.grantRole(STATE_SYNCER_ROLE, accounts[0])
  })

  it('should receive message on L2 with type1', async() => {
    const type1 = await testChildTunnel.TYPE1()
    const messageReceiveTx = await testChildTunnel.onStateReceive(0, abi.encode(['bytes32', 'uint256'], [type1, '4']))
    should.exist(messageReceiveTx)
    const n = await testChildTunnel.number()
    n.should.be.a.bignumber.that.equals('4')
  })

  it('should receive message on L2 with type2', async() => {
    const type2 = await testChildTunnel.TYPE2()
    const messageReceiveTx = await testChildTunnel.onStateReceive(0, abi.encode(['bytes32', 'uint256'], [type2, '1']))
    should.exist(messageReceiveTx)
    const n = await testChildTunnel.number()
    n.should.be.a.bignumber.that.equals('3')
  })

  it('should send message on L1', async() => {
    const n = await testChildTunnel.number()
    messageSentTx = await testChildTunnel.sendMessage(abi.encode(['uint256'], [n.toString()]))
    should.exist(messageSentTx)
  })

  it('should submit checkpoint', async() => {
    // submit checkpoint including message tx
    checkpointData = await submitCheckpoint(contracts.root.checkpointManager, messageSentTx.receipt)
    should.exist(checkpointData)
  })

  it('should match checkpoint details', async() => {
    const root = bufferToHex(checkpointData.header.root)
    should.exist(root)

    // fetch latest header number
    headerNumber = await contracts.root.checkpointManager.currentCheckpointNumber()
    headerNumber.should.be.bignumber.gt('0')

    // fetch header block details and validate
    const headerData = await contracts.root.checkpointManager.headerBlocks(headerNumber)
    root.should.equal(headerData.root)
  })

  it('should be able to call receive message', async() => {
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
    should.exist(receivedTx)
  })

  it('should set state receiving message', async() => {
    const number = await contracts.root.testRootTunnel.receivedNumber()
    number.should.be.bignumber.that.equals('3')
  })

  it('should fail while receiveing same message again', async() => {
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

    await expectRevert(contracts.root.testRootTunnel.receiveMessage(data), 'EXIT_ALREADY_PROCESSED')
  })
})
