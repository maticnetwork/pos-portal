import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBN from 'chai-bn'
import BN from 'bn.js'
import { defaultAbiCoder as abi } from 'ethers/utils/abi-coder'

import * as deployer from '../helpers/deployer'
import { mockValues } from '../helpers/constants'
import logDecoder from '../helpers/log-decoder.js'
import { constructERC1155DepositData } from '../helpers/utils'

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should()

contract('ChildERC1155', (accounts) => {
  describe('Should mint tokens on deposit', () => {
    const tokenId = mockValues.numbers[8]
    const depositAmount = mockValues.amounts[7]
    const user = mockValues.addresses[3]
    const depositData = constructERC1155DepositData([tokenId], [depositAmount])
    let contracts
    let oldAccountBalance
    let depositTx
    let transferLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts()
      oldAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
    })

    it('Can receive deposit tx', async() => {
      depositTx = await contracts.dummyERC1155.deposit(user, depositData)
      should.exist(depositTx)
    })

    it('Should emit TransferBatch log', () => {
      const logs = logDecoder.decodeLogs(depositTx.receipt.rawLogs)
      transferLog = logs.find(l => l.event === 'TransferBatch')
      should.exist(transferLog)
    })

    describe('Correct values should be emitted in TransferBatch log', () => {
      it('Event should be emitted by correct contract', () => {
        transferLog.address.should.equal(
          contracts.dummyERC1155.address.toLowerCase()
        )
      })

      it('Should emit proper operator', () => {
        transferLog.args.operator.should.equal(accounts[0])
      })

      it('Should emit proper from', () => {
        transferLog.args.from.should.equal(mockValues.zeroAddress)
      })

      it('Should emit proper to', () => {
        transferLog.args.to.should.equal(user)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferLog.args.ids[0]
        transferLogTokenId.toNumber().should.equal(tokenId)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferLog.args.values[0].toString())
        transferLogAmount.should.be.bignumber.that.equals(depositAmount)
      })
    })

    it('Deposit amount should be credited to deposit receiver', async() => {
      const newAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.add(depositAmount)
      )
    })
  })

  describe('Should burn tokens on withdrawSingle', () => {
    const withdrawAmount = mockValues.amounts[9]
    const depositAmount = withdrawAmount.add(mockValues.amounts[3])
    const tokenId = mockValues.numbers[4]
    const user = accounts[0]
    let contracts
    let oldAccountBalance
    let withdrawTx
    let transferSingleLog

    before(async() => {
      contracts = await deployer.deployFreshChildContracts()
      const depositData = constructERC1155DepositData([tokenId], [depositAmount])
      await contracts.dummyERC1155.deposit(user, depositData)
      oldAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
    })

    it('Can receive withdraw tx', async() => {
      withdrawTx = await contracts.dummyERC1155.withdrawSingle(tokenId, withdrawAmount)
      should.exist(withdrawTx)
    })

    it('Should emit TransferSingle log', () => {
      const logs = logDecoder.decodeLogs(withdrawTx.receipt.rawLogs)
      transferSingleLog = logs.find(l => l.event === 'TransferSingle')
      should.exist(transferSingleLog)
    })

    describe('Correct values should be emitted in TransferSingle log', () => {
      it('Event should be emitted by correct contract', () => {
        transferSingleLog.address.should.equal(
          contracts.dummyERC1155.address.toLowerCase()
        )
      })

      it('Should emit proper operator', () => {
        transferSingleLog.args.operator.should.equal(user)
      })

      it('Should emit proper From', () => {
        transferSingleLog.args.from.should.equal(user)
      })

      it('Should emit proper To', () => {
        transferSingleLog.args.to.should.equal(mockValues.zeroAddress)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferSingleLog.args.value.toString())
        transferLogAmount.should.be.bignumber.that.equals(withdrawAmount)
      })

      it('Should emit correct tokenId', () => {
        const transferLogTokenId = transferSingleLog.args.id
        transferLogTokenId.toNumber().should.equal(tokenId)
      })

      it('Should emit correct amount', () => {
        const transferLogAmount = new BN(transferSingleLog.args.value.toString())
        transferLogAmount.should.be.bignumber.that.equals(withdrawAmount)
      })
    })

    it('Withdraw amount should be deducted from user', async() => {
      const newAccountBalance = await contracts.dummyERC1155.balanceOf(user, tokenId)
      newAccountBalance.should.be.a.bignumber.that.equals(
        oldAccountBalance.sub(withdrawAmount)
      )
    })
  })
})
