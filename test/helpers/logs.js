import { RLP } from 'ethers/utils'

import {
  erc20TransferEventSig
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
