module.exports = {
  mnemonic: process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino',
  from: process.env.FROM || '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
  url: process.env.PROVIDER_URL || 'http://localhost:9545',
  gasPrice: process.env.GAS_PRICE || '45000000000', // 45 gwei
  plasmaRootChain: process.env.PLASMA_ROOT_CHAIN || '0x2890bA17EfE978480615e330ecB65333b880928e'
}
