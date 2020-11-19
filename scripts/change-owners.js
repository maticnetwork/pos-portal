const UpgradableProxy = artifacts.require('UpgradableProxy')
const AccessControl = artifacts.require('AccessControl')

const contractList = [
  // contract address list
  // '',
  // '',
  // ''
]

const newOwner = '' // new owner

const adminRole = '0x00'

module.exports = async(callback) => {
  if (!newOwner || !contractList || !contractList.length) {
    console.log('Set required params')
  } else {
    const accounts = await web3.eth.getAccounts()
    const user = accounts[0]

    console.log(`Changing owner from ${user} to ${newOwner}`)

    for (const contractAddress of contractList) {
      try {
        const contractInstance = await UpgradableProxy.at(contractAddress)
        const proxyOwner = await contractInstance.proxyOwner()
        if (user === proxyOwner) {
          // change proxy owner to newOwner
          await contractInstance.transferProxyOwnership(newOwner)
          console.log(`proxy owner of ${contractAddress} changed to ${newOwner}`)
        } else {
          console.log(`skipping proxy owner change of ${contractAddress} since user is not owner`)
        }
      } catch (e) {
        console.log(`Error while changing proxy owner of ${contractAddress}`)
        console.error(e)
      }

      try {
        const contractInstance = await AccessControl.at(contractAddress)
        const isAdmin = await contractInstance.hasRole(adminRole, user)
        if (isAdmin) {
          // grant admin to newOwner
          await contractInstance.grantRole(adminRole, newOwner)
          console.log(`admin of ${contractAddress} granted to ${newOwner}`)
          // revoke admin from user
          await contractInstance.revokeRole(adminRole, user)
          console.log(`admin of ${contractAddress} revoked from ${user}`)
        } else {
          console.log(`skipping admin change of ${contractAddress} since user is not admin`)
        }
      } catch (e) {
        console.log(`Error while changing admin of ${contractAddress}`)
        console.error(e)
      }
    }
  }
  callback()
}
