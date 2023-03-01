# Matic PoS (Proof-of-Stake) portal contracts

![Build Status](https://github.com/maticnetwork/pos-portal/workflows/CI/badge.svg)

Smart contracts that powers the PoS (proof-of-stake) based bridge mechanism for [Matic Network](https://matic.network). 

## Audits

- [Hexens](audits/Matic_PoS_upd.pdf)
- [Halborn](audits/Pos-portal-halborn-audit-07-07-2021.pdf)
- [CertiK](audits/Matic.Audit.CertiK.Report.pdf)
- [PeckShield](audits/Pos-portal-peckshield-audit-30-07-2021.pdf)

## Usage

Install package from **NPM** using

```bash
npm i @maticnetwork/pos-portal
```

## Develop

Make sure you've NodeJS & NPM installed

```bash
user:pos-portal anjan$ node --version
v12.18.1

user:pos-portal anjan$ npm --version
6.14.5
```

Clone repository & install all dependencies

```bash
git clone https://github.com/maticnetwork/pos-portal
cd pos-portal

npm i
```

Compile all contracts

```bash
npm run template:process
npm run build
```

If you prefer not using docker for compiling contracts, consider setting `docker: false` in truffle-config.js.

```js
// file: truffle-config.js
...

127|    solc: {
128|        version: '0.6.6',
129|        docker: false,
        }
...
```

For deploying all contracts in `pos-portal`, we need to have at least two chains running --- simulating RootChain ( Ethereum ) & ChildChain ( Polygon ). There are various ways of building this multichain setup, though two of them are majorly used

1. With `matic-cli`
2. Without `matic-cli`

`matic-cli` is a project, which makes setting up all components of Ethereum <-> Polygon multichain ecosystem easier. Three components matic-cli sets up for you

- Ganache ( simulating RootChain )
- Heimdall ( validator node of Polygon )
- Bor ( block production layer of Polygon i.e. ChildChain )

You may want to check [matic-cli](https://github.com/maticnetwork/matic-cli).

---

### 1. With `matic-cli`

Assuming you've installed `matic-cli` & set up single node local network by following [this guide](https://github.com/maticnetwork/matic-cli#usage), it's good time to start all components seperately as mentioned in `matic-cli` README.

This should give you RPC listen addresses for both RootChain ( read Ganache ) & ChildChain ( read Bor ), which need to updated in `pos-portal/truffle-config.js`. Also note Mnemonic you used when setting up local network, we'll make use of it for migrating pos-portal contracts.

`matic-cli` generates `~/localnet/config/contractAddresses.json`, given you decided to put network setup in `~/localnet` directory, which contains deployed Plasma contract addresses. We're primarily interested in Plasma RootChain ( deployed on RootChain, as name suggests aka *Checkpoint contract* ) & StateReceiver contract ( deployed on Bor ). These two contract addresses need to be updated [here](migrations/config.js).

> You may not need to change `stateReceiver` field, because that's where Bor deploys respective contract, by default.

> Plasma RootChain contract address is required for setting checkpoint manager in PoS RootChainManager contract during migration. PoS RootChainManager will talk to Checkpointer contract for verifying PoS exit proof.

```js
// file: migrations/config.js

module.exports = {
  plasmaRootChain: '0x<fill-it-up>', // aka checkpointer
  stateReceiver: '0x0000000000000000000000000000000000001001'
}
```

Now you can update preferred mnemonic to be used for migration in [truffle config](truffle-config.js)

```js
// file: truffle-config.js

29| const MNEMONIC = process.env.MNEMONIC || '<preferred-mnemonic>'
```

Also consider updating network configurations for `root` & `child` in truffle-config.js

```js
// make sure host:port of RPC matches properly
// that's where all following transactions to be sent

52| root: {
        host: 'localhost',
        port: 9545,
        network_id: '*', // match any network
        skipDryRun: true,
        gas: 7000000,
        gasPrice: '0'
    },
    child: {
        host: 'localhost',
        port: 8545,
        network_id: '*', // match any network
        skipDryRun: true,
        gas: 7000000,
        gasPrice: '0'
67| },
```

Now start migration, which is 4-step operation

Migration Step | Effect
:-- | --:
`migrate:2` | Deploys all rootchain contracts, on Ganache
`migrate:3` | Deploys all childchain contracts, on Bor
`migrate:4` | Initialises rootchain contracts, on Ganache
`migrate:5` | Initialises childchain contracts, on Bor


```bash
# assuming you're in root of pos-portal

npm run migrate # runs all steps
```

You've deployed all contracts required for pos-portal to work properly. All these addresses are put into `./contractAddresses.json`, which you can make use of for interacting with them.

> If you get into any problem during deployment, it's good idea to take a look at `truffle-config.js` or `package.json` --- and attempt to modify fields need to be modified.

> Migration files are kept here `./migrations/{1,2,3,4,5}*.js`

---

### 2. Without `matic-cli`

You can always independently start a Ganache instance to act as RootChain & Bor node as ChildChain, without using `matic-cli`. But in this case no Heimdall nodes will be there --- depriving you of StateSync/ Checkpointing etc. where validator nodes are required.

Start RootChain by

```bash
npm run testrpc # RPC on localhost:9545 --- default
```

Now start ChildChain ( requires docker )

```bash
npm run bor # RPC on localhost:8545 --- default
```

> If you ran a bor instance before, a dead docker container might still be lying around, clean it using following command:

```bash
npm run bor:clean # optional
```

Run testcases

```bash
npm run test
```

Deploy contracts on local Ganache & Bor instance

```bash
npm run migrate
```

This should generate `./contractAddresses.json`, which contains all deployed contract addresses --- use it for interacting with those.

---

### Production

> Use this guide for deploying contracts in Ethereum Mainnet.

1. Moonwalker needs rabbitmq and local geth running
```bash
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
npm run testrpc
```

2. Export env vars
```bash
export MNEMONIC=
export FROM=
export PROVIDER_URL=
export ROOT_CHAIN_ID=
export CHILD_CHAIN_ID=
export PLASMA_ROOT_CHAIN=
export GAS_PRICE=
```

3. Compile contracts
```bash
npm run template:process -- --root-chain-id $ROOT_CHAIN_ID --child-chain-id $CHILD_CHAIN_ID
npm run build
```

4. Add root chain contract deployments to queue
```bash
npm run truffle exec moonwalker-migrations/queue-root-deployment.js
```

5. Process queue (rerun if interrupted)
```bash
node moonwalker-migrations/process-queue.js
```

6. Extract contract addresses from moonwalker output
```bash
node moonwalker-migrations/extract-addresses.js
```

7. Deploy child chain contracts
```bash
npm run truffle -- migrate --network mainnetChild --f 3 --to 3
```

8. Add root chain initializations to queue
```bash
node moonwalker-migrations/queue-root-initializations.js
```

9. Process queue (rerun if interrupted)
```bash
node moonwalker-migrations/process-queue.js
```

10. Initialize child chain contracts
```bash
npm run truffle -- migrate --network mainnetChild --f 5 --to 5
```

11. Register State Sync
- Register RootChainManager and ChildChainManager on StateSender
- Set stateSenderAddress on RootChainManager
- Grant STATE_SYNCER_ROLE on ChildChainManager

---

### Command scripts (Management scripts)

```bash
npm run truffle exec scripts/update-implementation.js -- --network <network-name> <new-address>
```

---

### Transfer proxy ownership and admin role
Set list of contract addresses and new owner address in `6_change_owners.js` migration script  
Set `MNEMONIC` and `API_KEY` as env variables
```bash
npm run change-owners -- --network <network-name>
```
