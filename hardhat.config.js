// require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require('babel-register')
require('babel-polyfill')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = process.env.API_KEY

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {mnemonic: MNEMONIC},
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:9545",
      allowUnlimitedContractSize: true,
      gas: 90000000
    },
    // development: {
    //   url: 'localhost',
    //   port: 9545,
    //   network_id: '*', // match any network
    //   skipDryRun: true,
    //   gas: 7000000
    // },
  },
  solidity: "0.6.6",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};
