import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { generateFirstWallets, getSignatureParameters } from '../helpers/utils.js'
import { getTypedData } from '../helpers/meta-tx.js'
import { mockValues } from '../helpers/constants.js'

import { signTypedData } from 'eth-sig-util'
import { toBuffer } from 'ethereumjs-util'

let wallets = generateFirstWallets({ n: 10 })

contract('UChildERC20', (accounts) => {
  describe('Only admin should be able to change name', () => {
    const cinnamon = 'Cinnamon'
    const staranise = 'Star anise'
    const clove = 'Clove'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[4]
    const admin = accounts[0]
    const joe = accounts[1]
    let uChildERC20

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      uChildERC20 = contracts.uChildERC20
      await uChildERC20.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
    })

    it('Should have default name', async () => {
      const name = await uChildERC20.name()
      expect(name).to.equal(cinnamon)
    })

    it('Admin should be able to change name', async () => {
      await uChildERC20.changeName(staranise, { from: admin })
      const name = await uChildERC20.name()
      expect(name).to.equal(staranise)
    })

    it('Joe should not be able to change name', async () => {
      await expect(uChildERC20.connect(await ethers.getSigner(joe)).changeName(clove)).to.be.revertedWith(
        'ChildCSC: INSUFFICIENT_PERMISSIONS'
      )
      const name = await uChildERC20.name()
      expect(name).to.equal(staranise)
    })
  })

  describe('Only admin should be able to update contract implementation', () => {
    const clove = 'Clove'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[4]
    const admin = accounts[0]
    const joe = accounts[1]
    let uChildERC20Proxy
    let oldImplementation
    let newImplementation
    let uChildERC20Instance

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)

      const UChildERC20 = await ethers.getContractFactory("UChildERC20")
      const TestUChildERC20 = await ethers.getContractFactory("TestUChildERC20")

      oldImplementation = contracts.uChildERC20

      newImplementation = await TestUChildERC20.deploy()
      await newImplementation.waitForDeployment()

      uChildERC20Proxy = contracts.uChildERC20Proxy
      await uChildERC20Proxy.updateImplementation(oldImplementation.target, { from: admin })
      oldImplementation = await UChildERC20.attach(uChildERC20Proxy.target)
      await oldImplementation.initialize(clove, symbol, decimals, childChainManager, { from: admin })

      uChildERC20Instance = await TestUChildERC20.attach(oldImplementation.target)
    })

    it('Contract should be initialized', async () => {
      const name = await uChildERC20Instance.name()
      expect(name).to.equal(clove)
    })

    it('Magic function call should fail', async () => {
      await expect(uChildERC20Instance.magic()).to.be.reverted
    })

    it('Joe should not be able to update implementation', async () => {
      await expect(uChildERC20Proxy.connect(await ethers.getSigner(joe)).
        updateImplementation(newImplementation.target)).to.be.revertedWith(
          'NOT_OWNER'
        )
    })

    it('Admin should be able to update implementation', async () => {
      const tx = await uChildERC20Proxy.updateImplementation(newImplementation.target, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Magic function call should succeed', async () => {
      const response = await uChildERC20Instance.magic()
      expect(response).to.equal('magic')
    })
  })

  describe('Meta tx should work after name change', () => {
    const cinnamon = 'Cinnamon'
    const staranise = 'Star anise'
    const symbol = 'CSC'
    const decimals = 18
    const childChainManager = mockValues.addresses[2]
    const admin = accounts[0]
    const jack = wallets[4].getAddressString()
    const jackPK = toBuffer(wallets[4].getPrivateKeyString())
    const jill = mockValues.addresses[6]
    const amount = mockValues.amounts[3]
    let uChildERC20
    let web3UChildERC20

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)

      uChildERC20 = contracts.uChildERC20
      await uChildERC20.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
      await uChildERC20.changeName(staranise, { from: admin })

      const UChildERC20 = artifacts.require('UChildERC20')
      web3UChildERC20 = new web3.eth.Contract(UChildERC20.abi)
    })

    it('Admin should be able to send approve on behalf of jack', async () => {
      const functionSignature = await web3UChildERC20.methods.approve(
        jill,
        amount.toString(10)
      ).encodeABI()
      const name = await uChildERC20.name()
      const chainId = await uChildERC20.getChainId()
      const nonce = await uChildERC20.getNonce(jack)

      const sig = signTypedData(jackPK, {
        data: getTypedData({
          name,
          version: '1',
          chainId,
          verifyingContract: uChildERC20.target,
          nonce: '0x' + nonce.toString(16),
          from: jack,
          functionSignature: toBuffer(functionSignature)
        })
      })
      const { r, s, v } = getSignatureParameters(sig)
      const tx = await uChildERC20.executeMetaTransaction(jack, functionSignature, r, s, v, { from: admin })
      const receipt = await tx.wait()
      expect(receipt.status).to.equal(1)
    })

    it('Allowance should be proper', async () => {
      const allowance = await uChildERC20.allowance(jack, jill)
      expect(allowance).to.equals(amount)
    })
  })
})
