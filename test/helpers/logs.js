import { toUtf8Bytes, AbiCoder, encodeRlp, toBeHex } from 'ethers';
import {
  erc20TransferEventSig,
  erc721TransferEventSig,
  erc721WithdrawnBatchEventSig,
  erc721TransferWithMetadataEventSig,
  erc1155TransferSingleEventSig,
  erc1155TransferBatchEventSig,
  erc1155ChainExitEventSig
} from './constants.js';

const abi = new AbiCoder();

export const getERC20TransferLog = ({
  overrideSig,
  from,
  to,
  amount
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc20TransferEventSig,
      from,
      to
    ],
    toBeHex(amount)
  ]);
};

export const getERC721TransferLog = ({
  overrideSig,
  from,
  to,
  tokenId
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc721TransferEventSig,
      from,
      to,
      toBeHex(tokenId)
    ]
  ]);
};

export const getERC721WithdrawnBatchLog = ({
  overrideSig,
  user,
  tokenIds
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc721WithdrawnBatchEventSig,
      user
    ],
    abi.encode(
      [
        'uint256[]'
      ],
      [
        tokenIds.map(t => '0x' + t.toString(16))
      ]
    )
  ]);
};

export const getERC721TransferWithMetadataLog = ({
  overrideSig,
  from,
  to,
  tokenId,
  metaData
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc721TransferWithMetadataEventSig,
      from,
      to,
      '0x' + tokenId.toString(16)
    ],
    abi.encode(['bytes'], [abi.encode(['string'], [metaData])])
  ]);
};

export const getERC1155TransferSingleLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenId,
  amount
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc1155TransferSingleEventSig,
      operator,
      from,
      to
    ],
    abi.encode(['uint256', 'uint256'], ['0x' + tokenId.toString(16), '0x' + amount.toString(16)])
  ]);
};

export const getERC1155TransferBatchLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenIds,
  amounts
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc1155TransferBatchEventSig,
      operator,
      from,
      to
    ],
    abi.encode(
      [
        'uint256[]',
        'uint256[]'
      ],
      [
        tokenIds.map(t => '0x' + t.toString(16)),
        amounts.map(a => '0x' + a.toString(16))
      ]
    )
  ]);
};

export const getERC1155ChainExitLog = ({
  overrideSig,
  to,
  tokenIds,
  amounts,
  data
}) => {
  return encodeRlp([
    '0x',
    [
      overrideSig || erc1155ChainExitEventSig,
      to
    ],
    abi.encode(
      [
        'uint256[]',
        'uint256[]',
        'bytes'
      ],
      [
        tokenIds.map(t => '0x' + t.toString(16)),
        amounts.map(a => '0x' + a.toString(16)),
        `0x${Buffer.from(toUtf8Bytes(data || 'Hello World')).toString('hex')}`
      ]
    )
  ]);
};
