import * as ethers from "ethers";
const { rlp, bufferToHex } = require("ethereumjs-util");
import { ProofUtil } from "../../../hh/payload/proof_util";
import block from "../../../mockResponses/347-block.json";
import receipts from "../../../mockResponses/347-receipt-list.json";
import { ITransactionReceipt } from "../../../hh/payload/interface";

async function main() {
  const [arg] = process.argv.slice(2);
  const abi = new ethers.utils.AbiCoder();
  const idx = parseInt(arg);
  const receipt = receipts[idx];
  const receiptProof = (await ProofUtil.getReceiptProof(
    receipt,
    block,
    0 /*requestConcurrency*/,
    receipts as unknown as ITransactionReceipt[]
  )) as {
    blockHash: Buffer;
    parentNodes: Buffer[];
    root: Buffer;
    path: Buffer;
    value: ethers.BigNumber;
  };
  const payload = abi.encode(
    ["uint256", "bytes", "bytes", "bytes"],
    [
      block.receiptsRoot,
      // @ts-ignore
      bufferToHex(ProofUtil.getReceiptBytes(receipt)),
      // @ts-ignore
      bufferToHex(rlp.encode(receiptProof.parentNodes)),
      // @ts-ignore
      bufferToHex(Buffer.concat([Buffer.from("00", "hex"), receiptProof.path])),
    ]
  );
  console.log(payload);
}

main();
