const fs = require('fs')

module.exports = {
  getContractAddresses: () => {
    try {
      return JSON.parse(fs.readFileSync(`${process.cwd()}/contractAddresses.json`).toString())
    } catch (e) {
      return {
        root: {},
        child: {}
      }
    }
  },
  writeContractAddresses: (contractAddresses) => {
    fs.writeFileSync(
      `${process.cwd()}/contractAddresses.json`,
      JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
    )
  }
}
