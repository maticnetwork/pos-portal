
const program = require('commander')
const nunjucks = require('nunjucks')
const glob = require('glob')
const fs = require('fs')
const path = require('path')

program.version('0.0.1')
program.option('-c, --child-chain-id <child-chain-id>', 'Child chain id', '15001')
program.option('-r, --root-chain-id <root-chain-id>', 'Root chain id', '5')
program.parse(process.argv)

// joining path of directory
const directoryPath = path.join(__dirname, '..', '**/*.template')
// passsing directoryPath and callback function
glob(directoryPath, (err, files) => {
  // handling error
  if (err) {
    return console.log('Unable to scan directory: ' + err)
  }

  // listing all files using forEach
  files.forEach((file) => {
    if (fs.lstatSync(file).isDirectory()) {
      return
    }
    const childChainIdHex = parseInt(program.childChainId, 10)
      .toString(16)
      .toUpperCase()

    const rootChainIdHex = parseInt(program.rootChainId, 10)
      .toString(16)
      .toUpperCase()

    const data = {
      childChainId: program.childChainId,
      rootChainId: program.rootChainId,
      childChainIdHex:
        childChainIdHex.length % 2 !== 0 ? `0${childChainIdHex}` : childChainIdHex,
      rootChainIdHex:
        rootChainIdHex.length % 2 !== 0 ? `0${rootChainIdHex}` : rootChainIdHex
    }

    const templateString = fs.readFileSync(file).toString()
    const resultString = nunjucks.renderString(templateString, data)
    fs.writeFileSync(file.replace('.template', ''), resultString)
  })

  console.log('All template files have been processed.')
})
