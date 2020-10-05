import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import { syncState } from '../helpers/utils'

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('PotatoMigration', (accounts) => {
  describe('Should deposit and plant potatoes in single transaction', () => {
    let contracts
    const john = accounts[1]
    const plantAmount = mockValues.amounts[3]
    const bagAmount = plantAmount.add(mockValues.amounts[5])

    before(async() => {
      contracts = await deployer.deployPotatoContracts(accounts)
      await contracts.rootPotatoToken.mint(bagAmount, { from: john })
    })

    it('John should have lots of potatoes in his bag on root chain', async() => {
      const balance = await contracts.rootPotatoToken.balanceOf(john)
      balance.should.be.a.bignumber.greaterThan(plantAmount)
    })

    it('John should be able to plant potatoes on child chain', async() => {
      await contracts.rootPotatoToken.approve(
        contracts.rootPotatoMigrator.address,
        plantAmount,
        { from: john }
      )
      const tx = await contracts.rootPotatoMigrator.plantOnChildFarm(plantAmount, { from: john })
      const stateSyncTxList = await syncState({ tx })
      stateSyncTxList.length.should.equal(2)
    })

    it('John\'s bag should have proper amount of potatoes on root chain', async() => {
      const balance = await contracts.rootPotatoToken.balanceOf(john)
      balance.should.be.a.bignumber.that.equals(
        bagAmount.sub(plantAmount)
      )
    })

    it('Predicate should have proper amount of potatoes on root chain', async() => {
      const balance = await contracts.rootPotatoToken.balanceOf(
        contracts.erc20Predicate.address
      )
      balance.should.be.a.bignumber.that.equals(plantAmount)
    })

    it('Farm should have proper amount of potatoes on child chain', async() => {
      const balance = await contracts.childPotatoToken.balanceOf(
        contracts.childPotatoFarm.address
      )
      balance.should.be.a.bignumber.that.equals(plantAmount)
    })

    it('John\'s planted potatoes should be accounted on farm', async() => {
      const balance = await contracts.childPotatoFarm.plantedAmount(john)
      balance.should.be.a.bignumber.that.equals(plantAmount)
    })
  })
})
