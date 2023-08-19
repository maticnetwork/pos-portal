import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import * as sigUtils from 'eth-sig-util'
import * as ethUtils from 'ethereumjs-util'

import { generateFirstWallets, getSignatureParameters } from '../helpers/utils'
import { mockValues } from '../helpers/constants'
import { expectRevert } from '@openzeppelin/test-helpers'
import contracts from '../helpers/contracts'

const UChildERC20EIP3009 = artifacts.require('UChildERC20EIP3009')

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()
const wallets = generateFirstWallets({ n: 10 })

const web3UChildERC20EIP3009 = new web3.eth.Contract(UChildERC20EIP3009.abi)

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256(
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
)

const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256(
  'ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
)

const CANCEL_AUTHORIZATION_TYPEHASH = web3.utils.keccak256(
  'CancelAuthorization(address authorizer,bytes32 nonce)'
)

contract('UChildERC20EIP3009', (accounts) => {
  describe('Only admin should be able to change name', () => {
    const cinnamon = 'Cinnamon'
    const staranise = 'Star anise'
    const clove = 'Clove'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[4]
    const admin = accounts[0]
    const joe = accounts[1]
    let uChildERC20EIP3009

    before(async() => {
      uChildERC20EIP3009 = await contracts.UChildERC20EIP3009.new({ from: admin })
      await uChildERC20EIP3009.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
    })

    it('Should have default name', async() => {
      const name = await uChildERC20EIP3009.name()
      name.should.equal(cinnamon)
    })

    it('Admin should be able to change name', async() => {
      await uChildERC20EIP3009.changeName(staranise, { from: admin })
      const name = await uChildERC20EIP3009.name()
      name.should.equal(staranise)
    })

    it('Joe should not be able to change name', async() => {
      await expectRevert(
        uChildERC20EIP3009.changeName(clove, { from: joe }),
        'Transaction has been reverted by the EVM'
      )
      const name = await uChildERC20EIP3009.name()
      name.should.equal(staranise)
    })
  })

  describe('Only admin should be able to update contract implementation', () => {
    const clove = 'Clove'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[4]
    const admin = accounts[0]
    const joe = accounts[1]
    let uChildERC20EIP3009Proxy
    let oldImplementation
    let newImplementation
    let uChildERC20EIP3009Instance

    before(async() => {
      oldImplementation = await contracts.UChildERC20EIP3009.new({ from: admin })
      newImplementation = await contracts.TestUChildERC20.new({ from: admin })
      uChildERC20EIP3009Proxy = await contracts.UChildERC20Proxy.new(oldImplementation.address, { from: admin })
      uChildERC20EIP3009Instance = await contracts.TestUChildERC20.at(uChildERC20EIP3009Proxy.address, { from: admin })
      await uChildERC20EIP3009Instance.initialize(clove, symbol, decimals, childChainManager, { from: admin })
    })

    it('Contract should be initialized', async() => {
      const name = await uChildERC20EIP3009Instance.name()
      name.should.equal(clove)
    })

    it('Magic function call should fail', async() => {
      await expectRevert(
        uChildERC20EIP3009Instance.magic(),
        'execution reverted'
      )
    })

    it('Joe should not be able to update implementation', async() => {
      await expectRevert(
        uChildERC20EIP3009Proxy.updateImplementation(newImplementation.address, { from: joe }),
        'Transaction has been reverted by the EVM'
      )
    })

    it('Admin should be able to update implementation', async() => {
      await uChildERC20EIP3009Proxy.updateImplementation(newImplementation.address, { from: admin })
    })

    it('Magic function call should succeed', async() => {
      const response = await uChildERC20EIP3009Instance.magic()
      should.exist(response)
    })
  })

  describe('EIP3009', () => {
    const cinnamon = 'Cinnamon'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[2]
    const admin = accounts[0]
    const jack = wallets[4].getAddressString()
    const jackPK = ethUtils.toBuffer(wallets[4].getPrivateKeyString())
    const jill = mockValues.addresses[6]
    let uChildERC20EIP3009

    before(async() => {
      uChildERC20EIP3009 = await contracts.UChildERC20EIP3009.new({ from: admin })
      await uChildERC20EIP3009.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
    })

    it('has the expected type hashes', async() => {
      const transferHash = await uChildERC20EIP3009.TRANSFER_WITH_AUTHORIZATION_TYPEHASH()
      transferHash.should.equal(TRANSFER_WITH_AUTHORIZATION_TYPEHASH)

      const receiveHash = await uChildERC20EIP3009.RECEIVE_WITH_AUTHORIZATION_TYPEHASH()
      receiveHash.should.equal(RECEIVE_WITH_AUTHORIZATION_TYPEHASH)

      const cancelHash = await uChildERC20EIP3009.CANCEL_AUTHORIZATION_TYPEHASH()
      cancelHash.should.equal(CANCEL_AUTHORIZATION_TYPEHASH)
    })

    it('transferWithAuthorization', async() => {
      const name = await uChildERC20EIP3009.name()
      const chainId = await uChildERC20EIP3009.getChainId()
      const nonce = web3.utils.randomHex(32)
      const from = jack
      const to = jill
      const value = 0
      const validAfter = 0
      const validBefore = Math.floor(Date.now() / 1000) + 3600

      const sig = sigUtils.signTypedData(jackPK, {
        data: getTransferWithAuthorizationTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildERC20EIP3009.address,
          nonce,
          from,
          to,
          value,
          validAfter,
          validBefore
        })
      })

      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildERC20EIP3009.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s, { from: admin })
      should.exist(tx)

      const state = await uChildERC20EIP3009.authorizationState(from, nonce)
      state.should.equal(true)
    })

    it('receiveWithAuthorization', async() => {
      const name = await uChildERC20EIP3009.name()
      const chainId = await uChildERC20EIP3009.getChainId()
      const nonce = web3.utils.randomHex(32)
      const from = jack
      const to = admin
      const value = 0
      const validAfter = 0
      const validBefore = Math.floor(Date.now() / 1000) + 3600

      const sig = sigUtils.signTypedData(jackPK, {
        data: getReceiveWithAuthorizationTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildERC20EIP3009.address,
          nonce,
          from,
          to,
          value,
          validAfter,
          validBefore
        })
      })

      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildERC20EIP3009.receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s, { from: admin })
      should.exist(tx)

      const state = await uChildERC20EIP3009.authorizationState(from, nonce)
      state.should.equal(true)
    })

    it('cancelAuthorization', async() => {
      const name = await uChildERC20EIP3009.name()
      const chainId = await uChildERC20EIP3009.getChainId()
      const nonce = web3.utils.randomHex(32)
      const from = jack

      const sig = sigUtils.signTypedData(jackPK, {
        data: getCancelAuthorizationTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildERC20EIP3009.address,
          nonce,
          authorizer: from
        })
      })

      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildERC20EIP3009.cancelAuthorization(from, nonce, v, r, s, { from: admin })
      should.exist(tx)

      const state = await uChildERC20EIP3009.authorizationState(from, nonce)
      state.should.equal(true)
    })
  })
})

const getTransferWithAuthorizationTypedData = ({ name, version, chainId, verifyingContract, from, to, value, validAfter, validBefore, nonce }) => {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' }
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    domain: {
      name,
      version,
      verifyingContract,
      salt: '0x' + chainId.toString(16).padStart(64, '0')
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce
    }
  }
}

const getReceiveWithAuthorizationTypedData = ({ name, version, chainId, verifyingContract, from, to, value, validAfter, validBefore, nonce }) => {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' }
      ],
      ReceiveWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    domain: {
      name,
      version,
      verifyingContract,
      salt: '0x' + chainId.toString(16).padStart(64, '0')
    },
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce
    }
  }
}

const getCancelAuthorizationTypedData = ({ name, version, chainId, verifyingContract, authorizer, nonce }) => {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' }
      ],
      CancelAuthorization: [
        { name: 'authorizer', type: 'address' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    domain: {
      name,
      version,
      verifyingContract,
      salt: '0x' + chainId.toString(16).padStart(64, '0')
    },
    primaryType: 'CancelAuthorization',
    message: {
      authorizer,
      nonce
    }
  }
}
