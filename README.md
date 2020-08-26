# Matic PoS (Proof-of-Stake) portal contracts

![Build Status](https://github.com/maticnetwork/pos-portal/workflows/CI/badge.svg)

Smart contracts that powers the PoS (proof-of-stake) based bridge mechanism for [Matic Network](https://matic.network). 

### Setup

```bash
git clone https://github.com/maticnetwork/pos-portal
cd pos-portal

npm install
```

### Compile all contracts

```bash
npm run template:process
npm run build
```

### Start main chain and child chain

Start Main chain

```bash
npm run testrpc
```

Start Matic child chain (Requires docker)

```bash
npm run bor
```

If you ran a bor instance before, a dead docker container might still be lying around, clean it using following command:

```bash
npm run bor:clean
```

### Run testcases

```bash
npm run test
```

### Deploy contracts locally

```bash
npm run migrate
```


### Deploy contracts on mainnet
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
npm run truffle exec moonwalker-migrations/queue-root-initializations.js
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
