import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'

import { mockValues } from '../helpers/constants'
import { expectRevert } from '@openzeppelin/test-helpers'
import contracts from '../helpers/contracts'
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

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

    before(async() => {
      uChildERC20 = await contracts.UChildERC20.new({ from: admin })
      await uChildERC20.initialize(cinnamon, symbol, decimals, childChainManager, { from: admin })
    })

    it('Should have default name', async() => {
      const name = await uChildERC20.name()
      name.should.equal(cinnamon)
    })

    it('Admin should be able to change name', async() => {
      await uChildERC20.changeName(staranise, { from: admin })
      const name = await uChildERC20.name()
      name.should.equal(staranise)
    })

    it('Joe should not be able to change name', async() => {
      await expectRevert(uChildERC20.changeName(clove, { from: joe }), 'Transaction has been reverted by the EVM')
      const name = await uChildERC20.name()
      name.should.equal(staranise)
    })
  })
})
