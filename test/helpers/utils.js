import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'
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

export const constructERC1155DepositData = (ids, amounts) => {
  return abi.encode(
    [
      'uint256[]',
      'uint256[]',
      'bytes'
    ],
    [
      ids.map(i => i.toString()),
      amounts.map(a => a.toString()),
      ['0x0']
    ]
  )
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
export function generateFirstWallets({
  mnemonics = packageJSON.config.mnemonics,
  n = 10,
  hdPathIndex = 0
}) {
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics))
  const result = []
  for (let i = 0; i < n; i++) {
    const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex || 0}`)
    result.push(node.getWallet())
  }

  return result
}

export const getSignatureParameters = (signature) => {
  const r = signature.slice(0, 66)
  const s = '0x'.concat(signature.slice(66, 130))
  const _v = '0x'.concat(signature.slice(130, 132))
  let v = parseInt(_v)
  if (![27, 28].includes(v)) v += 27
  return { r, s, v }
}
