# Matic PoS (Proof-of-Stake) portal contracts

![Build Status](https://github.com/maticnetwork/pos-portal/workflows/CI/badge.svg)

Ethereum smart contracts that powers the PoS portal for [Matic Network](https://matic.network).

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
