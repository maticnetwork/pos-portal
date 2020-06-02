require('babel-register')
require('babel-polyfill')

/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require('@truffle/hdwallet-provider')
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();
const mnemonic = 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    root: {
      // host: 'localhost',
      // port: 9545,
      // network_id: '53227'
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          'https://ropsten.infura.io/v3/70645f042c3a409599c60f96f6dd9fbc'
        ),
      network_id: 3,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true
    },
    child: {
      // host: 'localhost',
      // port: 8545,
      // network_id: '96410'
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          'https://testnetv3.matic.network'
        ),
      network_id: 15001,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.6",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    }
  }
}
