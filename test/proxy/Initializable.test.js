import { expect } from 'chai'

describe('Initializable', function () {
  let ProxyTestImpl, impl

  before(async function () {
    ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
    impl = await ProxyTestImpl.deploy()
  })

  it('must initialize', async function () {
    await impl.init()
  })

  it('must revert when attempt to initialize again', async function () {
    await expect(impl.init()).to.be.revertedWith('already inited')
  })
})
