var fs = require('fs')
var files = fs.readdirSync('artifacts')

files.forEach(f => {
  const name = `artifacts/${f}`
  const abi = JSON.parse(fs.readFileSync(name)).abi
  if (!abi.length) {
    fs.unlinkSync(name)
  } else {
    fs.writeFileSync(name, JSON.stringify({ abi }) + '\n')
  }
})
