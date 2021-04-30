import { RLP } from 'ethers/utils'
import { AbiCoder } from 'ethers/utils'

import {
  erc20TransferEventSig,
  erc20BurnEventSig,
  erc721TransferEventSig,
  erc721BatchWithdrawSig,
  erc721TransferWithMetadataEventSig,
  erc721BurnEventSig,
  erc721BatchBurnEventSig,
  erc721BurnWithMetadataEventSig,
  erc1155TransferSingleEventSig,
  erc1155TransferBatchEventSig,
  erc1155TransferSingleWithMetadataEventSig,
  erc1155TransferBatchWithMetadataEventSig,
  erc1155BurnSingleEventSig,
  erc1155BurnBatchEventSig,
  erc1155BurnSingleWithMetadataEventSig,
  erc1155BurnBatchWithMetadataEventSig
} from './constants'

const abi = new AbiCoder()

export const getERC20TransferLog = ({
  overrideSig,
  from,
  to,
  amount
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc20TransferEventSig,
      from,
      to
    ],
    '0x' + amount.toString(16)
  ])
}

export const getERC20BurnLog = ({
  overrideSig,
  from,
  amount
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc20BurnEventSig,
      from
    ],
    '0x' + amount.toString(16)
  ])
}

export const getERC721TransferLog = ({
  overrideSig,
  from,
  to,
  tokenId
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721TransferEventSig,
      from,
      to,
      '0x' + tokenId.toString(16)
    ]
  ])
}

export const getERC721BatchWithdraw = ({
  overrideSig,
  user,
  tokenIds
}) => {

  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721BatchWithdrawSig,
      user
    ],
    abi.encode(
      ['uint256[]'],
      [tokenIds.map(t => '0x' + t.toString(16))]
    )
  ])

}

export const getERC721TransferWithMetadataLog = ({
  overrideSig,
  from,
  to,
  tokenId,
  metaData
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721TransferWithMetadataEventSig,
      from,
      to,
      '0x' + tokenId.toString(16)
    ],
    // ABI encoded metadata, because that's how dummy root token expects it
    //
    // @note Two level serialisation is required because we're emitting
    // event with `bytes` field, which will be serialised by EVM itself
    // as `abi.encode(data)`, result into final level of serialised form
    //
    // Before that actual metadata we're interested in passing cross
    // chain needs to be serialised, which is what gets emitted via event
    // on L2
    abi.encode(['bytes'], [abi.encode(['string'], [metaData])])
  ])
}

export const getERC721BurnLog = ({
  overrideSig,
  from,
  tokenId
}) => {

  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721BurnEventSig,
      from,
      '0x' + tokenId.toString(16)
    ]
  ])

}

export const getERC721BatchBurnLog = ({
  overrideSig,
  from,
  tokenIds
}) => {

  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721BatchBurnEventSig,
      from
    ],
    abi.encode(
      ['uint256[]'],
      [tokenIds.map(t => '0x' + t.toString(16))]
    )
  ])

}

export const getERC721BurnWithMetadataLog = ({
  overrideSig,
  from,
  tokenId,
  metaData
}) => {

  return RLP.encode([
    '0x0',
    [
      overrideSig || erc721BurnWithMetadataEventSig,
      from,
      '0x' + tokenId.toString(16)
    ],
    abi.encode(['bytes'], [abi.encode(['string'], [metaData])]) // ABI encoded metadata, because that's how dummy root token expects it
  ])

}

export const getERC1155TransferSingleLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenId,
  amount
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155TransferSingleEventSig,
      operator,
      from,
      to
    ],
    abi.encode(['uint256', 'uint256'], ['0x' + tokenId.toString(16), '0x' + amount.toString(16)])
  ])
}

export const getERC1155TransferBatchLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenIds,
  amounts
}) => {
  return RLP.encode([
    '0x0',
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
  ])
}

export const getERC1155TransferSingleWithMetadataLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenId,
  amount,
  metaData
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155TransferSingleWithMetadataEventSig,
      operator,
      from,
      to
    ],
    abi.encode(['uint256', 'uint256', 'bytes'], ['0x' + tokenId.toString(16), '0x' + amount.toString(16), abi.encode(['string'], [metaData])])
  ])
}

export const getERC1155TransferBatchWithMetadataLog = ({
  overrideSig,
  operator,
  from,
  to,
  tokenIds,
  amounts,
  metaData
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155TransferBatchWithMetadataEventSig,
      operator,
      from,
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
        abi.encode(['string'], [metaData])
      ]
    )
  ])
}

export const getERC1155BurnSingleLog = ({
  overrideSig,
  operator,
  from,
  tokenId,
  amount
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155BurnSingleEventSig,
      operator,
      from
    ],
    abi.encode(['uint256', 'uint256'], ['0x' + tokenId.toString(16), '0x' + amount.toString(16)])
  ])
}

export const getERC1155BurnBatchLog = ({
  overrideSig,
  operator,
  from,
  tokenIds,
  amounts
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155BurnBatchEventSig,
      operator,
      from
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
  ])
}

export const getERC1155BurnSingleWithMetadataLog = ({
  overrideSig,
  operator,
  from,
  tokenId,
  amount,
  metaData
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155BurnSingleWithMetadataEventSig,
      operator,
      from
    ],
    abi.encode(['uint256', 'uint256', 'bytes'], ['0x' + tokenId.toString(16), '0x' + amount.toString(16), abi.encode(['string'], [metaData])])
  ])
}

export const getERC1155BurnBatchWithMetadataLog = ({
  overrideSig,
  operator,
  from,
  tokenIds,
  amounts,
  metaData
}) => {
  return RLP.encode([
    '0x0',
    [
      overrideSig || erc1155BurnBatchWithMetadataEventSig,
      operator,
      from
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
        abi.encode(['string'], [metaData])
      ]
    )
  ])
}
