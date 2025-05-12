import { AbiCoder } from 'ethers'
import { deployFreshChildContracts } from '../helpers/deployerNew.js'
import { expect } from 'chai'
import { mockValues } from '../helpers/constants.js'

const abi = new AbiCoder()

contract('ChildERC20', (accounts) => {
  describe('Should mint tokens on deposit', () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let contracts
    let oldAccountBalance

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      oldAccountBalance = await contracts.dummyERC20.balanceOf(depositReceiver)
      const DEPOSITOR_ROLE = await contracts.dummyERC20.DEPOSITOR_ROLE()
      await contracts.dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
    })

    it('Can receive deposit tx', async () => {
      await expect(
        contracts.dummyERC20.deposit(depositReceiver, depositData)
      ).to.emit(contracts.dummyERC20, 'Transfer').withArgs(
        mockValues.zeroAddress,
        depositReceiver,
        depositAmount
      )
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC20.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(depositReceiver)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.value.toString())
    //     transferLogAmount.should.be.bignumber.that.equals(depositAmount)
    //   })
    // })

    it('Deposit amount should be credited to deposit receiver', async () => {
      const newAccountBalance = await contracts.dummyERC20.balanceOf(depositReceiver)
      expect(newAccountBalance).to.be.equal(oldAccountBalance + depositAmount)
    })
  })

  describe('Deposit called by non depositor account', () => {
    const depositAmount = mockValues.amounts[0]
    const depositReceiver = mockValues.addresses[4]
    const depositData = abi.encode(['uint256'], [depositAmount.toString()])
    let dummyERC20

    before(async () => {
      const contracts = await deployFreshChildContracts(accounts)
      dummyERC20 = contracts.dummyERC20
    })

    it('Tx should revert with proper reason', async () => {
      await expect(
        dummyERC20.connect(await ethers.getSigner(accounts[1])).deposit(depositReceiver, depositData))
        .to.be.revertedWith('ChildERC20: INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Should burn tokens on withdraw', () => {
    const withdrawAmount = mockValues.amounts[2]
    const depositAmount = withdrawAmount + mockValues.amounts[3]
    const user = accounts[0]
    let contracts
    let oldAccountBalance

    before(async () => {
      contracts = await deployFreshChildContracts(accounts)
      const DEPOSITOR_ROLE = await contracts.dummyERC20.DEPOSITOR_ROLE()
      await contracts.dummyERC20.grantRole(DEPOSITOR_ROLE, accounts[0])
      const depositData = abi.encode(['uint256'], [depositAmount.toString()])
      await contracts.dummyERC20.deposit(user, depositData)
      oldAccountBalance = await contracts.dummyERC20.balanceOf(user)
    })

    it('Can receive withdraw tx', async () => {
      await expect(
        contracts.dummyERC20.withdraw(withdrawAmount)
      ).to.emit(contracts.dummyERC20, 'Transfer').withArgs(
        user,
        mockValues.zeroAddress,
        withdrawAmount
      )
    })

    // @note Already verified in the above test
    // it('Should emit Transfer log', () => {
    //   const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
    //   transferLog = logs.find(l => l.event === 'Transfer')
    //   should.exist(transferLog)
    // })

    // describe('Correct values should be emitted in Transfer log', () => {
    //   it('Event should be emitted by correct contract', () => {
    //     transferLog.address.should.equal(
    //       contracts.dummyERC20.address.toLowerCase()
    //     )
    //   })

    //   it('Should emit proper From', () => {
    //     transferLog.args.from.should.equal(user)
    //   })

    //   it('Should emit proper To', () => {
    //     transferLog.args.to.should.equal(mockValues.zeroAddress)
    //   })

    //   it('Should emit correct amount', () => {
    //     const transferLogAmount = new BN(transferLog.args.value.toString())
    //     transferLogAmount.should.be.bignumber.that.equals(withdrawAmount)
    //   })
    // })

    it('Withdraw amount should be deducted from user', async () => {
      const newAccountBalance = await contracts.dummyERC20.balanceOf(user)
      expect(newAccountBalance).to.be.equal(oldAccountBalance - withdrawAmount)
    })
  })
})
