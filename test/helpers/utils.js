import BN from 'bn.js'
import bip39 from 'bip39'
import hdkey from 'ethereumjs-wallet/hdkey'
import packageJSON from '../../package.json'

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

export function assertBigNumberEquality(num1, num2) {
  if (!BN.isBN(num1)) num1 = web3.utils.toBN(num1.toString())
  if (!BN.isBN(num2)) num2 = web3.utils.toBN(num2.toString())
  assert(
    num1.eq(num2),
    `expected ${num1.toString(10)} and ${num2.toString(10)} to be equal`
  )
}

export const mnemonics = packageJSON.config.mnemonics
export function generateFirstWallets(mnemonics, n, hdPathIndex = 0) {
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics))
  const result = []
  for (let i = 0; i < n; i++) {
    const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`)
    result.push(node.getWallet())
  }

  return result
}
