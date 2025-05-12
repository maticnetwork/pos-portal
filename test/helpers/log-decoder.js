import { ethers } from 'ethers';
import { initializeContracts } from './contracts.js';

export class LogDecoder {
  constructor(abis = []) {
    this._methodIDs = {};
    this._interfaces = [];
    abis.forEach(abi => {
      const methodInterface = new ethers.Interface(abi);
      Object.keys(methodInterface.events).forEach(evtKey => {
        const evt = methodInterface.events[evtKey];
        const signature = evt.topic;
        // Handles different indexed arguments with same signature from different initializeContracts
        // Like ERC721/ERC20 Transfer
        this._methodIDs[signature] = this._methodIDs[signature] || [];
        this._methodIDs[signature].push(evt);
        this._interfaces.push(methodInterface);
      });
    });
  }

  decodeLogs(logs = []) {
    return logs.map(log => {
      for (let i = 0; i < this._interfaces.length; i++) {
        try {
          const parsedLog = this._interfaces[i].parseLog(log);
          if (parsedLog) {
            return {
              address: log.address.toLowerCase(),
              event: parsedLog.name,
              signature: parsedLog.signature,
              args: parsedLog.values
            };
          }
        } catch (e) {
        }
      }
    });
  }
}

const abis = [];
Object.keys(initializeContracts).forEach(c => {
  if (initializeContracts[c]._json && initializeContracts[c]._json.abi) {
    abis.push(initializeContracts[c]._json.abi);
  } else {
    console.warn(`Contract ${c} is missing _json or abi property.`);
  }
});

export const logDecoder = new LogDecoder(abis);
