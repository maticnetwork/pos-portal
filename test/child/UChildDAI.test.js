import { BN } from 'bn.js'
import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { generateFirstWallets, getSignatureParameters } from '../helpers/utils.js'
import { mockValues } from '../helpers/constants.js'

import { toBuffer } from 'ethereumjs-util'
import { signTypedData } from 'eth-sig-util'

let wallets = generateFirstWallets({ n: 10 })

contract('UChildDAI', (accounts) => {
  describe('Set approval using permit function', async () => {
    const cinnamon = 'Cinnamon'
    const staranise = 'Star anise'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[2]
    const admin = accounts[0]
    const jack = wallets[4].getAddressString()
    const jackPK = toBuffer(wallets[4].getPrivateKeyString())
    const jill = mockValues.addresses[6]
    const maxAmount = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex')
    const zeroAmount = new BN(0)
    let uChildDAI

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      uChildDAI = contracts.uChildDAI
      await uChildDAI.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
      await uChildDAI.changeName(staranise, { from: admin })
    })

    it('Contract should be initialized properly', async () => {
      const name = await uChildDAI.name()
      expect(name).to.equal(staranise)
      const _symbol = await uChildDAI.symbol()
      expect(_symbol).to.equal(symbol)
      const _decimals = await uChildDAI.decimals()
      expect(_decimals).to.equal(decimals)
    })

    it(`Admin should be able to permit jill to spend jack's tokens using offline signature`, async () => {
      const name = await uChildDAI.name()
      const chainId = await uChildDAI.getChainId()
      const nonce = await uChildDAI.getNonce(jack)

      const sig = signTypedData(jackPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildDAI.target,
          nonce: '0x' + nonce.toString(16),
          holder: jack,
          spender: jill,
          allowed: true
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildDAI.permit(jack, jill, nonce, 0, true, v, r, s, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Allowance should be max', async () => {
      const allowance = await uChildDAI.allowance(jack, jill)
      expect(allowance).to.equal(maxAmount)
    })

    it(`Admin should be able to block jill from spending jack's tokens using offline signature`, async () => {
      const name = await uChildDAI.name()
      const chainId = await uChildDAI.getChainId()
      const nonce = await uChildDAI.getNonce(jack)

      const sig = signTypedData(jackPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildDAI.target,
          nonce: '0x' + nonce.toString(16),
          holder: jack,
          spender: jill,
          allowed: false
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildDAI.permit(jack, jill, nonce, 0, false, v, r, s, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Allowance should be zero', async () => {
      const allowance = await uChildDAI.allowance(jack, jill)
      expect(allowance).to.equal(zeroAmount)
    })
  })
})

const getTypedData = ({ name, version, chainId, verifyingContract, nonce, holder, spender, expiry, allowed }) => {
  return {
    types: {
      EIP712Domain: [
        {
          name: 'name',
          type: 'string'
        },
        {
          name: 'version',
          type: 'string'
        },
        {
          name: 'verifyingContract',
          type: 'address'
        },
        {
          name: 'salt',
          type: 'bytes32'
        }
      ],
      Permit: [
        {
          name: 'holder',
          type: 'address'
        },
        {
          name: 'spender',
          type: 'address'
        },
        {
          name: 'nonce',
          type: 'uint256'
        },
        {
          name: 'expiry',
          type: 'uint256'
        },
        {
          name: 'allowed',
          type: 'bool'
        }
      ]
    },
    domain: {
      name,
      version,
      verifyingContract,
      salt: '0x' + chainId.toString(16).padStart(64, '0')
    },
    primaryType: 'Permit',
    message: {
      holder,
      spender,
      nonce,
      expiry: expiry || 0,
      allowed
    }
  }
}
