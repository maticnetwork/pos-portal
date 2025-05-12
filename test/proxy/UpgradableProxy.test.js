import { assertBigNumberEquality } from '../helpers/utils.js';
import { expect } from 'chai';

let UpgradableProxy, ProxyTestImpl, ProxyTestImplStorageLayoutChange;

before(async function () {
  UpgradableProxy = await ethers.getContractFactory('UpgradableProxy');
  ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl');
  ProxyTestImplStorageLayoutChange = await ethers.getContractFactory('ProxyTestImplStorageLayoutChange');
});

contract('UpgradableProxy', function (accounts) {

  async function doDeploy() {
    this.impl = await ProxyTestImpl.deploy();
    await this.impl.waitForDeployment();
    this.proxy = await UpgradableProxy.deploy(this.impl.target);
    await this.proxy.waitForDeployment();
    this.testContract = ProxyTestImpl.attach(this.proxy.target);
  }

  describe('updateImplementation', function () {
    before(doDeploy)
    before(async function () {
      this.newImpl = await ProxyTestImpl.deploy();
      await this.newImpl.waitForDeployment();
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        await expect(
          this.proxy.connect(await ethers.getSigner(accounts[1])).updateImplementation(this.newImpl.target)
        ).to.be.revertedWith('NOT_OWNER');
      })
    })

    describe('when from is owner', function () {
      it('must update implementation', async function () {
        await this.proxy.updateImplementation(this.newImpl.target)
        this.newTestContract = await ProxyTestImpl.attach(this.proxy.target)
      })

      it('must have correct implementation', async function () {
        const impl = await this.proxy.implementation()
        expect(impl).to.be.equal(this.newImpl.target)
      })

      it('must have a == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '0')
      })

      it('must have b == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '0')
      })

      it('must have ctorInit == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.ctorInit(), '0')
      })

      it('must invoke init()', async function () {
        await this.newTestContract.init()
      })

      it('must have a == 1', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('transferOwnership', function () {
    before(doDeploy)
    before(async function () {
      this.newOwner = accounts[1]
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        await expect(
          this.proxy.connect(await ethers.getSigner(this.newOwner)).transferProxyOwnership(this.newOwner)
        ).to.be.revertedWith('NOT_OWNER');
      })
    })

    describe('when from is owner', function () {
      it('must update owner', async function () {
        await this.proxy.transferProxyOwnership(this.newOwner)
      })

      it('must have correct owner', async function () {
        const owner = await this.proxy.proxyOwner()
        expect(owner).to.be.equal(this.newOwner)
      })
    })
  })

  describe('updateAndCall', function () {
    before(doDeploy)
    before(async function () {
      this.newImpl = await ProxyTestImpl.deploy();
      await this.newImpl.waitForDeployment();
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        await expect(
          this.proxy.connect(await ethers.getSigner(accounts[1])).updateImplementation(this.newImpl.target)
        ).to.be.revertedWith('NOT_OWNER');
      })
    })

    describe('when from is owner', function () {
      it('must update and initialize new implementation', async function () {
        const calldata = this.newImpl.interface.encodeFunctionData('init')

        await this.proxy.updateAndCall(this.newImpl.target, calldata)
        this.newTestContract = ProxyTestImpl.attach(this.proxy.target)
      })

      it('must have a == 1', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('when implementation is not contract', function () {
    before(doDeploy)

    it('reverts', async function () {
      await expect(
        this.proxy.updateImplementation(accounts[1])
      ).to.be.revertedWith('DESTINATION_ADDRESS_IS_NOT_A_CONTRACT');
    })
  })

  describe('when implementation changes storage layout', function () {
    before(doDeploy)
    before(async function () {
      await this.testContract.init()

      this.newImpl = await ProxyTestImplStorageLayoutChange.deploy();
      await this.newImpl.waitForDeployment();
      await this.proxy.updateImplementation(this.newImpl.target)

      this.newTestContract = ProxyTestImplStorageLayoutChange.attach(this.proxy.target)
    })

    it('must have a == 2', async function () {
      assertBigNumberEquality(await this.newTestContract.a(), '2')
    })

    it('must have b == 1', async function () {
      assertBigNumberEquality(await this.newTestContract.b(), '1')
    })
  })
})
