import { readFileSync, writeFileSync } from 'fs'

export function getContractAddresses() {
  try {
    return JSON.parse(readFileSync(`${process.cwd()}/contractAddresses.json`).toString())
  } catch (e) {
    return {
      root: {},
      child: {}
    }
  }
}
export function writeContractAddresses(contractAddresses) {
  writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  )
}
