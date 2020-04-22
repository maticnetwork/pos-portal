import BN from 'bn.js'

export const encodeStateSyncerData = (user, rootToken, amount) => {
  return '0x' +
    user.slice(2).padStart(64, '0') +
    rootToken.slice(2).padStart(64, '0') +
    amount.toString(16).padStart(64, '0')
}

export const decodeStateSenderData = (data) => {
  const user = '0x' + data.slice(26, 66)
  const rootToken = '0x' + data.slice(90, 130)
  const amount = new BN(data.slice(131, 194), 16)
  return { user, rootToken, amount }
}
