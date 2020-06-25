import { keccak256, BN, toBuffer } from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'

const sha3 = keccak256

export async function getHeaders(start, end, web3) {
  if (start >= end) {
    return []
  }

  let current = start
  let p = []
  const result = []
  while (current <= end) {
    p = []

    for (let i = 0; i < 10 && current <= end; i++) {
      p.push(web3.eth.getBlock(current))
      current++
    }

    if (p.length > 0) {
      result.push(...(await Promise.all(p)))
    }
  }

  return result.map(getBlockHeader)
}

export function getBlockHeader(block) {
  const n = new BN(block.number).toArrayLike(Buffer, 'be', 32)
  const ts = new BN(block.timestamp).toArrayLike(Buffer, 'be', 32)
  const txRoot = toBuffer(block.transactionsRoot)
  const receiptsRoot = toBuffer(block.receiptsRoot)
  return sha3(Buffer.concat([n, ts, txRoot, receiptsRoot]))
}
