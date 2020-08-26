const EthDeployer = require('moonwalker').default
const HDWalletProvider = require('@truffle/hdwallet-provider')
const config = require('./config')

const wallet = new HDWalletProvider(config.mnemonic, config.url)

async function consume() {
  const q = await EthDeployer.getQueue()
  const worker = new EthDeployer.Worker(
    wallet, q, {
      from: config.from,
      gas: 6000000,
      gasPrice: config.gasPrice
    },
    `${process.cwd()}/build`,
    0 // blockConfirmation
  )
  await worker.start('default-deposit-q')
  return 'worker started...'
}

consume()
