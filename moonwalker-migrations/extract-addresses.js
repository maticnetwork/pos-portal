const status = require('../build/status.json')
let contractAddresses
try {
  contractAddresses = require('../contractAddresses.json')
} catch (e) {
  contractAddresses = { root: {}, child: {} }
}
const fs = require('fs')

Object.keys(status)
  .map(key => status[key])
  .filter(each => each.type === 'deploy')
  .forEach(each => {
    contractAddresses.root[each.contract] = each.address
  })

fs.writeFileSync('./contractAddresses.json', JSON.stringify(contractAddresses, null, 2)) // Indent 2 spaces
