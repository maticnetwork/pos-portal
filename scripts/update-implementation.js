const contractAddresses = require('../contractAddresses.json')

const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')

async function updateImplementation(address) {
  const rootChainManager = await RootChainManagerProxy.at(
    contractAddresses.root.RootChainManagerProxy
  )

  let currentImplementation = await rootChainManager.implementation()
  console.log("Current ChildChainManagerProxy implementation address", currentImplementation)

  const data = rootChainManager.contract.methods.updateImplementation(address).encodeABI()
  console.log("ChildChainManagerProxy updateImplementation ABI encoded data:", data)
}

module.exports = async function(callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log('Current configured address to make transactions:', accounts[0])

    // set validator share address
    // -- --network <network-name> <new-address>
    await updateImplementation(process.argv[6])
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
