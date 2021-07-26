import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { expectRevert } from '@openzeppelin/test-helpers'
import { bufferToHex, rlp, toBuffer } from 'ethereumjs-util'

import * as deployer from '../helpers/deployer'
import { rootWeb3 as web3 } from '../helpers/contracts'

// Enable and inject BN dependency
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ExitPayloadReader', function(accounts) {
  let contracts

  before(async() => {
    contracts = await deployer.deployInitializedContracts(accounts)
  })

  it('should parse typed receipt', async function() {
    const txType = '0x1'
    const receiptData = Buffer.concat([toBuffer(txType), rlp.encode([
      toBuffer(txType), // type
      toBuffer(1000), // cumulative gas
      toBuffer('0x000000000'), // logs bloom
      [] // logs
    ])])

    const receipt = [
      '1',
      bufferToHex(toBuffer('0x0')),
      '2',
      '3',
      bufferToHex(toBuffer('0x000000000')),
      bufferToHex(toBuffer('0x000000000')),
      bufferToHex(receiptData),
      bufferToHex(toBuffer('0x000000000')),
      bufferToHex(toBuffer('0x000000000')), // branch mask,
      '4'
    ]

    const data = bufferToHex(
      rlp.encode(receipt)
    )

    const parsedReceipt = await contracts.root.exitPayloadReaderTest.tryParseReceipt(data)

    should.equal(parsedReceipt.raw, bufferToHex(receiptData))
  })
})
