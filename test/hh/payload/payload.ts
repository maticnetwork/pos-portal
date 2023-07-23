import { ethers } from "hardhat";
import { ProofUtil } from "./proof_util";
import { IBaseBlock, ITransactionReceipt } from "./interface";
import ethUtils from "ethereumjs-util";
import { MerkleTree } from "./merkle_tree";

export function getLogIndex(logEventSig: string, receipt: any) {
  let logIndex = -1;

  switch (logEventSig) {
    case "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
    case "0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14":
      logIndex = receipt.logs.findIndex(
        (log: any) =>
          log.topics[0].toLowerCase() === logEventSig.toLowerCase() &&
          log.topics[2].toLowerCase() ===
            "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      break;

    case "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62":
    case "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb":
      logIndex = receipt.logs.findIndex(
        (log: any) =>
          log.topics[0].toLowerCase() === logEventSig.toLowerCase() &&
          log.topics[3].toLowerCase() ===
            "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      break;

    default:
      logIndex = receipt.logs.findIndex(
        (log: any) => log.topics[0].toLowerCase() === logEventSig.toLowerCase()
      );
  }
  if (logIndex < 0) {
    throw new Error("Log not found in receipt");
  }
  return logIndex;
}

export function getReceiptBytes(receipt: ITransactionReceipt) {
  return ethUtils.rlp.encode([
    ethUtils.bufferToHex(
      Buffer.from(
        receipt.status !== undefined && receipt.status != null
          ? receipt.status
            ? "0x1"
            : "0x"
          : receipt.root,
        "hex"
      )
    ),
    ethUtils.bufferToHex(receipt.cumulativeGasUsed),
    ethUtils.bufferToHex(receipt.logsBloom),

    // encoded log array
    receipt.logs.map((l) => {
      // [address, [topics array], data]
      return [
        ethUtils.bufferToHex(l.address), // convert address to buffer
        l.topics.map(ethUtils.bufferToHex), // convert topics to buffer
        ethUtils.bufferToHex(l.data), // convert data to buffer
      ];
    }),
  ]);
}

export function encodePayload(
  headerNumber: any,
  buildBlockProof: any,
  blockNumber: any,
  timestamp: any,
  transactionsRoot: any,
  receiptsRoot: any,
  receipt: any,
  receiptParentNodes: any,
  path: any,
  logIndex: any
) {
  return ethUtils.bufferToHex(
    ethUtils.rlp.encode([
      headerNumber,
      buildBlockProof,
      blockNumber,
      timestamp,
      ethUtils.bufferToHex(transactionsRoot),
      ethUtils.bufferToHex(receiptsRoot),
      ethUtils.bufferToHex(receipt),
      ethUtils.bufferToHex(ethUtils.rlp.encode(receiptParentNodes)),
      ethUtils.bufferToHex(Buffer.concat([Buffer.from("00", "hex"), path])),
      logIndex,
    ])
  );
}

export function buildBlockProof(
  maticWeb3: any,
  startBlock: number,
  endBlock: number,
  blockNumber: number
) {
  return ProofUtil.getFastMerkleProof(
    maticWeb3,
    blockNumber,
    startBlock,
    endBlock
  ).then((proof) => {
    return ethUtils.bufferToHex(
      Buffer.concat(
        proof.map((p) => {
          return ethUtils.toBuffer(p);
        })
      )
    );
  });
}

export async function getHeaders(
  start: number,
  end: number,
  provider: typeof ethers.provider
) {
  if (start >= end) {
    return [];
  }
  let current = start;
  let p = [];
  let result = [];
  while (current <= end) {
    p = [];
    for (let i = 0; i < 10 && current <= end; i++) {
      p.push(
        ethers.provider.send("eth_getBlockByNumber", [
          ethers.utils.hexValue(current),
          true,
        ])
      );
      current++;
    }
    if (p.length > 0) {
      result.push(...(await Promise.all(p)));
    }
  }
  return result.map(getBlockHeader);
}

export function getBlockHeader(block: IBaseBlock) {
  // const n = new ethUtils.BN(block.number).toArrayLike(Buffer, 'be', 32)
  // const ts = new ethUtils.BN(block.timestamp).toArrayLike(Buffer, 'be', 32)
  const n = ethUtils.toBuffer(ethUtils.setLengthLeft(block.number, 32));
  const ts = ethUtils.toBuffer(ethUtils.setLengthLeft(block.timestamp, 32));

  const txRoot = ethUtils.toBuffer(block.transactionsRoot);
  const receiptsRoot = ethUtils.toBuffer(block.receiptsRoot);

  return ethUtils.keccak256(Buffer.concat([n, ts, txRoot, receiptsRoot]));
}

export async function buildPayloadForExit(
  burnTxHash: string,
  logEventSig = "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036",
  headerBlockNumber = 0,
  isFast = false
) {
  const requestConcurrency = 0;
  const receipt = await ethers.provider.getTransactionReceipt(burnTxHash);
  const block = await ethers.provider.send("eth_getBlockByNumber", [
    ethers.utils.hexValue(receipt.blockNumber),
    true,
  ]);
  const rootBlockInfo = {
    start: parseInt(block.number) - 1,
    end: parseInt(block.number),
    headerBlockNumber,
  };

  const headers = await getHeaders(
    rootBlockInfo.start,
    rootBlockInfo.end,
    ethers.provider
  );
  const tree = new MerkleTree(headers);

  const fullBlockHeader = getBlockHeader(
    (await ethers.provider.send("eth_getBlockByNumber", [
      ethers.utils.hexValue(block.number),
      true,
    ])) as unknown as IBaseBlock
  );

  const blockProofBuffer = tree.getProof(fullBlockHeader);
  const blockProof = ethUtils.bufferToHex(Buffer.concat(blockProofBuffer));

  const receiptProof: any = await ProofUtil.getReceiptProof(
    receipt,
    block,
    requestConcurrency,
    await Promise.all(
      block.transactions.map((tx: any) =>
        ethers.provider.getTransactionReceipt(tx.hash)
      )
    )
  );

  const logIndex = getLogIndex(logEventSig, receipt);

  return {
    burnProof: encodePayload(
      rootBlockInfo.headerBlockNumber,
      blockProof,
      block.number,
      block.timestamp,
      Buffer.from(block.transactionsRoot.slice(2), "hex"),
      Buffer.from(block.receiptsRoot.slice(2), "hex"),
      ProofUtil.getReceiptBytes(receipt), // rlp encoded
      receiptProof.parentNodes,
      receiptProof.path,
      logIndex
    ),
    root: ethUtils.bufferToHex(tree.getRoot()),
  };
}
