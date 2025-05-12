import { bufferToHex, rlp, toBuffer } from 'ethereumjs-util';
import { deployInitializedContracts } from '../helpers/deployerNew.js';
import { expect } from 'chai';

contract('ExitPayloadReader', function (accounts) {
  let contracts

  before(async () => {
    contracts = await deployInitializedContracts(accounts)
  })

  it('should parse typed receipt', async function () {
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

    expect(parsedReceipt.raw).to.equal(bufferToHex(receiptData))
  })
})

// @todo remove if not needed
// module.exports = {
//   expectRevert,
//   bufferToHex,
//   rlp,
//   toBuffer,
//   web3
// }
