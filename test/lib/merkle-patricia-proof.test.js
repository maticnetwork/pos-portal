import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { rlp } from 'ethereumjs-util'
import block from '../mockResponses/347-block.json'
import receiptList from '../mockResponses/347-receipt-list.json'
import { getReceiptProof, verifyReceiptProof, getReceiptBytes } from '../helpers/proofs'

const MerklePatriciaTest = artifacts.require('MerklePatriciaTest')

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

contract('MerklePatriciaTest', (accounts) => {
  let merklePatriciaTest

  before(async() => {
    merklePatriciaTest = await MerklePatriciaTest.new()
  })

  it('Proof verification should succeed for all 347 transactions in block', async() => {
    await Promise.all(
      receiptList.map(async(receipt) => {
        const receiptProof = await getReceiptProof(receipt, block, null /* web3 */, receiptList)

        const jsVerified = await verifyReceiptProof(receiptProof)
        jsVerified.should.equal(true, `Proof verification in js failed for receipt ${receipt.transactionIndex}`)

        const contractVerified = await merklePatriciaTest.verify(
          block.receiptsRoot,
          getReceiptBytes(receipt),
          rlp.encode(receiptProof.parentNodes),
          Buffer.concat([
            Buffer.from('00', 'hex'),
            receiptProof.path
          ])
        )
        contractVerified.should.equal(true, `Proof verification on contract failed for receipt ${receipt.transactionIndex}`)

        process.stdout.write(`\r      Proof verified for receipt ${receipt.transactionIndex}`)
      })
    )
    console.log()
  })
})
