import { expect } from 'chai'
import { getReceiptProof, verifyReceiptProof, getReceiptBytes } from '../helpers/proofs.js'
import { rlp } from 'ethereumjs-util'
import fs from 'fs'

const block = JSON.parse(fs.readFileSync(new URL('../mockResponses/347-block.json', import.meta.url)))
const receiptsRoot = block.receiptsRoot
const receiptList = JSON.parse(fs.readFileSync(new URL('../mockResponses/347-receipt-list.json', import.meta.url)))
const MerklePatriciaTest = artifacts.require('MerklePatriciaTest')

describe('MerklePatriciaTest', function () {
  // This case verifies all 347 receipts in the block, twice each (once in js, once on-chain).
  // It takes ~35s on a warm dev machine, which sits right on mocha's 40s default and tips over
  // it intermittently when the rest of the suite is competing for the same process — roughly
  // one run in three. The work is genuinely this large, so give it real headroom rather than
  // letting CI go red at random.
  this.timeout(180000)

  let merklePatriciaTest

  before(async () => {
    merklePatriciaTest = await MerklePatriciaTest.new()
  })

  it('Proof verification should succeed for all 347 transactions in block', async () => {
    await Promise.all(
      receiptList.map(async (receipt) => {
        const receiptProof = await getReceiptProof(receipt, block, null /* web3 */, receiptList)

        const jsVerified = verifyReceiptProof(receiptProof)
        expect(jsVerified).to.equal(true, `Proof verification in js failed for receipt ${receipt.transactionIndex}`)

        const contractVerified = await merklePatriciaTest.verify(
          receiptsRoot,
          getReceiptBytes(receipt),
          rlp.encode(receiptProof.parentNodes),
          Buffer.concat([Buffer.from('00', 'hex'), receiptProof.path])
        )
        expect(contractVerified).to.equal(
          true,
          `Proof verification on contract failed for receipt ${receipt.transactionIndex}`
        )

        process.stdout.write(`\r      Proof verified for receipt ${receipt.transactionIndex}`)
      })
    )
    console.log()
  })
})
