import { deployPotatoContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues } from '../helpers/constants.js'
import { syncState } from '../helpers/utils.js'

contract('PotatoMigration', (accounts) => {
  describe('Should deposit and plant potatoes in single transaction', () => {
    let contracts
    let john
    const plantAmount = mockValues.amounts[3]
    const bagAmount = plantAmount + mockValues.amounts[5]

    before(async () => {
      john = await ethers.getSigner(accounts[1])
      contracts = await deployPotatoContracts(accounts)
      await contracts.rootPotatoToken.connect(john).mint(bagAmount)
    })

    it('John should have lots of potatoes in his bag on root chain', async () => {
      const balance = await contracts.rootPotatoToken.balanceOf(john)
      expect(balance).to.be.greaterThan(plantAmount)
    })

    it('John should be able to plant potatoes on child chain', async () => {
      await contracts.rootPotatoToken.connect(john).approve(contracts.rootPotatoMigrator.target, plantAmount)
      const tx = await contracts.rootPotatoMigrator.connect(john).plantOnChildFarm(plantAmount)
      const txReceipt = await tx.wait()
      const stateSyncTxList = await syncState(txReceipt)
      expect(stateSyncTxList.length).to.equal(2)
    })

    it("John's bag should have proper amount of potatoes on root chain", async () => {
      const balance = await contracts.rootPotatoToken.balanceOf(john)
      expect(balance).to.be.equals(bagAmount - plantAmount)
    })

    it('Predicate should have proper amount of potatoes on root chain', async () => {
      const balance = await contracts.rootPotatoToken.balanceOf(contracts.erc20Predicate.target)
      expect(balance).to.be.equals(plantAmount)
    })

    it('Farm should have proper amount of potatoes on child chain', async () => {
      const balance = await contracts.childPotatoToken.balanceOf(contracts.childPotatoFarm.target)
      expect(balance).to.be.equals(plantAmount)
    })

    it("John's planted potatoes should be accounted on farm", async () => {
      const balance = await contracts.childPotatoFarm.plantedAmount(john)
      expect(balance).to.be.equals(plantAmount)
    })
  })
})
