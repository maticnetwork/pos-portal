# Polygon PoS (Proof-of-Stake) portal contracts

![Build Status](https://github.com/maticnetwork/pos-portal/workflows/CI/badge.svg)

Smart contracts that powers the PoS (proof-of-stake) based bridge mechanism for [Polygon Network](https://polygon.technology/).

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

## Hardhat Build

Make sure you have installed NodeJS, NVM & NPM.
Clone repository, switch to the required node version & install all dependencies

```bash
git clone https://github.com/0xPolygon/pos-portal
cd pos-portal

nvm i
nvm use
npm i
npm run build
```

## Hardhat Tests

After building as mentioned above, run the following command to run Hardhat tests

```bash
npm run test
```

## Foundry Build

Make sure you have installed Foundry.
Run the following command to run Foundry build

```bash
npm run generate:interfaces # generate interfaces with updated solc version
forge build
```

## Foundry Tests

Modify the following in the `.env` file (create one if it doesn't exist)

```env
# Infura API token - used for fork testing
INFURA_TOKEN=
# Deployer private key - your private key, that has enough funds to deploy contracts on forked networks
PRIVATE_KEY=
```

After building as mentioned above, run the following command to run Foundry tests

```bash
forge test
```

### Known Issues

- `ForkupgradeMPT.t.sol` can take a while to complete. if it does, you can run the following command to skip it

```bash
forge test --no-match-test "SkipCI"
```

## Verifying against the deployed bridge

The tree reproduces the bridge deployed on mainnet, byte for byte. `scripts/pinning/verify-bytecode.sh`
checks that claim: it compiles every core bridge contract with the compiler settings it was
deployed with and compares the result against `eth_getCode` on Ethereum and Polygon.

```bash
scripts/pinning/verify-bytecode.sh        # all chains
scripts/pinning/verify-bytecode.sh 1      # Ethereum mainnet only
```

Needs `jq`, `python3` and Foundry. It uses keyless public RPCs by default; export
`MAINNET_RPC_URL` / `POLYGON_POS_RPC_URL` to override. Everything it downloads and builds goes
into the gitignored `verify-onchain/` directory, including a hex dump of both sides of any
mismatch under `verify-onchain/diffs/`.

The inventory lives in `scripts/pinning/pinned-contracts.json` and covers the managers, the
eight token predicates, the immutable proxy shells and the child-token code that many mapped
tokens share. **Individual mapped tokens are out of scope** — only immutable or shared code is
tracked.

Four things are worth knowing before editing a contract in that inventory:

- **The proxy shells can never be redeployed.** `UpgradableProxy` is held at the exact source
  the live shells were compiled from. Improving it silently breaks reproducibility for all
  twelve of them, so any change belongs in a new contract, not that one.
- **Compiler settings are per-contract, not global.** The predicates deployed in 2020-21 used
  optimizer runs 200; `RootChainManager` and `ERC20Predicate` were redeployed via Foundry in
  2025 at runs 999999; the proxy shells were deployed with the optimizer *off*. Note that
  `runs` still affects output when the optimizer is disabled — solc consults it when choosing
  the function dispatcher.
- **A shared interface is a deployment constraint.** Adding a method to `ITokenPredicate`
  forces a stub into all eight predicates, and any predicate not redeployed alongside it stops
  reproducing. That is why migration lives in `IMigratableTokenPredicate`, implemented only by
  `ERC20Predicate`.
- **`legacy/` directories are load-bearing, not dead code.** Where the live system still runs a
  source this repo has moved past, the old source is frozen rather than lost:
  `contracts/common/legacy/` holds the pre-refactor EIP-712 chain the child tokens were built
  on (the modern `EIP712Base` is live too, under `RootChainManager` — the two cannot be merged
  without breaking one of them), and `contracts/lib/legacy/` holds the hardened RLP reader that
  `ChainExitERC1155Predicate` was deployed against, before it was replaced with the upstream
  library in 2021. Deleting or "tidying" either one breaks verification for the deployments
  that depend on it.

The inventory should stay fully green. If a contract needs to change ahead of a deploy, put the
change on its own branch and merge it when the deploy happens, rather than landing it on a
long-lived branch and marking the entry as drift. The verifier does support a `knownDrift` escape hatch —
it reports without failing, and flags the exemption as stale if the contract starts reproducing
again — but nothing uses it today, and it is meant for cases that cannot be resolved any other
way. The check runs in CI on `master`, `main` and `dev`.

Nothing is `exclude`d and nothing is marked as drift: all 30 entries reproduce.

Six of them are the same contract at six addresses. AAVE, UNI, CRV, SUSHI, BAL and GHST still run
the child-ERC20 build from before `changeName()` was added, and each deploys its own instance of
the implementation, so the six entries are 14161 identical bytes at six different addresses. Only
UNI's happens to sit at the address you would guess.

That build is not a legacy tail — it is what **~2,085 of the ~2,107** proxied mapped ERC20s on
Polygon run, about **99 %** (measured Aug 2026 by walking `RootChainManager`'s full `TokenMapped`
history). The newer build that `UChildERC20 (impl, WBTC)` pins is behind roughly **ten** tokens;
`UChildDAI` covers exactly one. Those counts are in the entry notes on purpose: to identify any
mapped token's implementation, read `implementation()` on the child token and compare that
address's runtime against these entries — the 99 % entry will match almost every time.

The six reproduce from `UChildERC20Common.sol`, which is that build's verified source with its flattened preamble
swapped for imports of the identical modules already in the repo — the match proves those modules
are byte-for-byte what was inlined. `UChildERC20.sol` is the same contract plus `changeName()` and
cannot produce both.

They are six entries rather than one representative because the `liveness` pointer is per token:
if any of the six is upgraded to the current implementation, that entry goes `STALE_POINTER` and
gets removed, which one shared entry would quietly hide. The same build is what nearly every mapped
ERC20 on Amoy runs too — 19 of 20 sampled.

## Deploying

Deployment is done with Foundry scripts under `scripts/forge/`, each with an
`input.json.example` showing the parameters it expects:

| Script | Purpose |
|---|---|
| `grant-role/` | grant a role on RootChainManager or a predicate |
| `transfer-ownership/` | move proxy ownership |
| `migrate-bridge-funds/` | move funds out of a predicate (see the security notes) |
| `update-impl-timelock/` | swap an implementation via the Timelock |
| `update-impl-multisig/` | swap an implementation held directly by a multisig |

Broadcast records from past runs are kept under `broadcast/`.

> The previous Truffle/`matic-cli` migration flow documented here has been removed: it depended on
> `truffle-config.js`, a `migrations/` directory and an `npm run migrate` script, none of which
> exist any more. `git log` has the old instructions if you need them.
