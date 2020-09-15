import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import * as sigUtils from 'eth-sig-util'
import * as ethUtils from 'ethereumjs-util'

import { generateFirstWallets, getSignatureParameters } from '../helpers/utils'
import { mockValues } from '../helpers/constants'
import contracts from '../helpers/contracts'

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const wallets = generateFirstWallets({ n: 10 })

contract('UChildDAI', (accounts) => {
  describe('Set approval using permit function', () => {
    const cinnamon = 'Cinnamon'
    const staranise = 'Star anise'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[2]
    const admin = accounts[0]
    const jack = wallets[4].getAddressString()
    const jackPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
    const jill = mockValues.addresses[6]
    const maxAmount = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex')
    const zeroAmount = new BN(0)
    let uChildDAI

    before(async() => {
      uChildDAI = await contracts.UChildDAI.new({ from: admin })
      await uChildDAI.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
      await uChildDAI.changeName(staranise, { from: admin })
    })

    it('Contract should be initialized properly', async() => {
      const name = await uChildDAI.name()
      name.should.equal(staranise)
      const _symbol = await uChildDAI.symbol()
      _symbol.should.equal(symbol)
      const _decimals = await uChildDAI.decimals()
      _decimals.toNumber().should.equal(decimals)
    })

    it(`Admin should be able to permit jill to spend jack's tokens using offline signature`, async() => {
      const name = await uChildDAI.name()
      const chainId = await uChildDAI.getChainId()
      const nonce = await uChildDAI.getNonce(jack)

      const sig = sigUtils.signTypedData(jackPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildDAI.address,
          nonce: '0x' + nonce.toString(16),
          holder: jack,
          spender: jill,
          allowed: true
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildDAI.permit(jack, jill, nonce, 0, true, v, r, s, { from: admin })
      should.exist(tx)
    })

    it('Allowance should be max', async() => {
      const allowance = await uChildDAI.allowance(jack, jill)
      allowance.should.be.a.bignumber.that.equals(maxAmount)
    })

    it(`Admin should be able to block jill from spending jack's tokens using offline signature`, async() => {
      const name = await uChildDAI.name()
      const chainId = await uChildDAI.getChainId()
      const nonce = await uChildDAI.getNonce(jack)

      const sig = sigUtils.signTypedData(jackPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildDAI.address,
          nonce: '0x' + nonce.toString(16),
          holder: jack,
          spender: jill,
          allowed: false
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildDAI.permit(jack, jill, nonce, 0, false, v, r, s, { from: admin })
      should.exist(tx)
    })

    it('Allowance should be zero', async() => {
      const allowance = await uChildDAI.allowance(jack, jill)
      allowance.should.be.a.bignumber.that.equals(zeroAmount)
    })
  })
})

const getTypedData = ({ name, version, chainId, verifyingContract, nonce, holder, spender, expiry, allowed }) => {
  return {
    types: {
      EIP712Domain: [{
        name: 'name',
        type: 'string'
      }, {
        name: 'version',
        type: 'string'
      }, {
        name: 'verifyingContract',
        type: 'address'
      }, {
        name: 'salt',
        type: 'bytes32'
      }],
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
