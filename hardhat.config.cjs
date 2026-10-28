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
    mainnetRoot: {
      url: process.env.MAINNET_RPC_URL || 'https://mainnet.gateway.tenderly.co',
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
      url: process.env.POLYGON_POS_RPC_URL || 'https://polygon.gateway.tenderly.co',
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
