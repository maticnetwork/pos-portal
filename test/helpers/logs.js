import { RLP } from 'ethers/utils'

import {
  erc20TransferEventSig,
  erc721TransferEventSig
} from './constants'

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
