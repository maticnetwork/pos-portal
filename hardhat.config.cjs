require('@nomiclabs/hardhat-truffle5');
require('hardhat/config');
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-web3");

const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";

module.exports = {
  solidity: {
    version: '0.6.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'istanbul'
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "istanbul", // disables EIP-1559, only legacy txs
    },
    development: {
      url: 'http://localhost:9545',
      gas: 7000000,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    root: {
      url: 'http://localhost:9545',
      gas: 7000000,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    child: {
      url: 'http://localhost:8545',
      gas: 7000000,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    mumbaiRoot: {
      url: `https://goerli.infura.io/v3/${process.env.API_KEY}`,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    mumbaiChild: {
      url: 'https://rpc-mumbai.matic.today',
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    mainnetRoot: {
      url: `https://mainnet.infura.io/v3/${process.env.API_KEY}`,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    mainnetChild: {
      url: 'https://rpc-mainnet.matic.network',
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    }
  }
}
