import "@nomicfoundation/hardhat-toolbox";
import "@primitivefi/hardhat-marmite";
require("@nomicfoundation/hardhat-foundry");
import { HardhatUserConfig } from "hardhat/config";
require("dotenv").config();

const MNEMONIC =
  process.env.MNEMONIC ||
  "clock radar mass judge dismiss just intact mind resemble fringe diary casino";
const MNEMONIC_DEV =
  process.env.MNEMONIC_DEV ||
  "clock radar mass judge dismiss just intact mind resemble fringe diary casino";

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    mumbaiRoot: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      url: `https://ethereum-goerli.publicnode.com`,
      chainId: 5,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
    },
    mumbaiChild: {
      accounts: {
        mnemonic: MNEMONIC_DEV,
      },
      url: "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
    },
    mainnetRoot: {
      accounts: {
        mnemonic: MNEMONIC_DEV,
      },
      url: `https://eth.rpc-poly.net/eth`,
      chainId: 1,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
    },
    mainnetChild: {
      accounts: {
        mnemonic: MNEMONIC_DEV,
      },
      url: "https://rpc-poly.net/polygon",
      chainId: 137,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
    },
  },
  paths: { tests: "test/hh" },
  solidity: {
    compilers: [
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "istanbul",
        },
      },
    ],
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: process.env.REPORT_GAS === "true",
    excludeContracts: [],
  },
  etherscan: !process.env.ETHERSCAN_TOKEN
    ? {}
    : { apiKey: process.env.ETHERSCAN_TOKEN },
  mocha: {
    timeout: 100000,
  },
} as HardhatUserConfig;
