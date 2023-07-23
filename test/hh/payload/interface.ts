export interface ILog {
  address: string;
  data: string;
  topics: string[];
  logIndex: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
}

export interface IEventLog {
  event: string;
  address: string;
  returnValues: any;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: string[] };
}

export interface ITransactionReceipt {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  from: string;
  to: string;
  contractAddress: string;
  cumulativeGasUsed: number;
  gasUsed: number;
  logs: ILog[];
  events?: {
    [eventName: string]: IEventLog;
  };
  status: boolean;
  logsBloom: string;
  root: string;
  type: string;
}

export interface IBaseBlock {
  size: number;
  difficulty: number;
  totalDifficulty: number;
  uncles: string[];
  number: number;
  hash: string;
  parentHash: string;
  nonce: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  extraData: string;
  gasLimit: number;
  gasUsed: number;
  timestamp: number | string;
}

export interface ITransactionData {
  transactionHash: string;
  nonce: number;
  blockHash: string | null;
  blockNumber: number | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: number;
  input: string;
}

export interface IBlockWithTransaction extends IBaseBlock {
  transactions: ITransactionData[];
}
