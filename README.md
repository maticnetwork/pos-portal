# Matic PoS (Proof-of-Stake) portal contracts

Ethereum smart contracts that powers the PoS portal for [Matic Network](https://matic.network).

### Setup

```bash
git clone https://github.com/maticnetwork/pos-portal
cd pos-portal

npm install
```

### Compile all contracts

```bash
npm run build
```

### Run testcases

```bash
npm run bor # run matic chain locally
npm run test
```

### Deploy contracts locally

```bash
npm run bor # run matic chain locally
npm run migrate
```
