import { expect } from 'chai'
import { getReceiptProof, verifyReceiptProof, getReceiptBytes } from '../helpers/proofs.js'
import { rlp } from 'ethereumjs-util'
import fs from 'fs';

const block = JSON.parse(fs.readFileSync(new URL('../mockResponses/347-block.json', import.meta.url)));
const receiptsRoot = block.receiptsRoot;
const receiptList = JSON.parse(fs.readFileSync(new URL('../mockResponses/347-receipt-list.json', import.meta.url)));
const MerklePatriciaTest = artifacts.require('MerklePatriciaTest')

describe('MerklePatriciaTest', function () {

  let merklePatriciaTest

  before(async () => {
    merklePatriciaTest = await MerklePatriciaTest.new()
  })

  it('Proof verification should succeed for all 347 transactions in block', async () => {
    await Promise.all(receiptList.map(async (receipt) => {
      const receiptProof = await getReceiptProof(receipt, block, null /* web3 */, receiptList)

      const jsVerified = verifyReceiptProof(receiptProof)
      expect(jsVerified).to.equal(true, `Proof verification in js failed for receipt ${receipt.transactionIndex}`)

      const contractVerified = await merklePatriciaTest.verify(
        receiptsRoot,
        getReceiptBytes(receipt),
        rlp.encode(receiptProof.parentNodes),
        Buffer.concat([
          Buffer.from('00', 'hex'),
          receiptProof.path
        ])
      )
      expect(contractVerified).to.equal(true, `Proof verification on contract failed for receipt ${receipt.transactionIndex}`)

      process.stdout.write(`\r      Proof verified for receipt ${receipt.transactionIndex}`)
    }))
    console.log()
  })
})
