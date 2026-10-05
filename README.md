# Polygon PoS (Proof-of-Stake) portal contracts

[![CI](https://github.com/maticnetwork/pos-portal/actions/workflows/test.yml/badge.svg)](https://github.com/maticnetwork/pos-portal/actions/workflows/test.yml)
[![Verify on-chain pinning](https://github.com/maticnetwork/pos-portal/actions/workflows/verify-pinning.yml/badge.svg)](https://github.com/maticnetwork/pos-portal/actions/workflows/verify-pinning.yml)

Smart contracts that power the PoS (proof-of-stake) bridge for [Polygon Network](https://polygon.technology/):
`RootChainManager` plus per-token predicates on Ethereum, `ChildChainManager` plus child tokens on
Polygon.

## Audits

- [Hexens](audits/Matic_PoS_upd.pdf)
- [Halborn](audits/Pos-portal-halborn-audit-07-07-2021.pdf)
- [CertiK](audits/Matic.Audit.CertiK.Report.pdf)
- [PeckShield](audits/Pos-portal-peckshield-audit-30-07-2021.pdf)

## Repository layout

| Path | Contents |
|---|---|
| `contracts/root/` | Ethereum side — `RootChainManager`, the eight token predicates, proxies |
| `contracts/child/` | Polygon side — `ChildChainManager`, child token implementations |
| `contracts/common/` | shared mixins: proxy, access control, EIP-712, initializable |
| `contracts/lib/` | proof libraries — `RLPReader`, `MerklePatriciaProof`, `ExitPayloadReader`, `Merkle` |
| `contracts/tunnel/` | the generic L1↔L2 message tunnel |
| `forge/` | Foundry tests |
| `test/` | Hardhat tests |
| `scripts/forge/` | deployment and governance scripts |
| `scripts/pinning/` | the on-chain bytecode verifier |

`contracts/common/legacy/` and `contracts/lib/legacy/` hold frozen sources — see
[Before editing a pinned contract](#before-editing-a-pinned-contract) before touching them.

## Getting started

Requires Node (see `.nvmrc`) and [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
git clone https://github.com/maticnetwork/pos-portal
cd pos-portal

nvm install && nvm use
npm ci

# Generates Solidity interface stubs from the compiled artifacts into
# scripts/helpers/interfaces/. Must run before `forge build`, because the
# contracts under forge/ and scripts/ import them.
npm run generate:interfaces

forge build
```

`npm run build` (`hardhat compile`) is also available; the Hardhat tests use it.

## Testing

There are two suites, and they are not redundant in the places that matter.

```bash
forge test --no-match-test "SkipCI"    # 139 tests
npm test                               # 550 tests (Hardhat)
```

**Foundry** (`forge/`) covers the predicates and both managers at unit level — lock/exit happy
paths, access control, revert cases — plus the migration-status logic on `RootChainManager`.

**Hardhat** (`test/`) overlaps substantially on the predicates, but is the only place with the
end-to-end flow: `test/root/Withdraw.test.js` runs deposit → burn → checkpoint → exit across every
token type. It also covers the proxy, initializable, meta-transaction, tunnel and child-token
contracts, none of which Foundry touches.

Both run on an in-process chain — no external node is needed. `npm run testrpc` starts an anvil
instance on port 9545 for the `development` / `root` networks in `hardhat.config.cjs`, but nothing
in the test suite requires it.

### The fork test

`forge/ForkupgradeMPT.t.sol` forks mainnet and replays 5,215 real historical exit payloads from
`forge/batchExit.json` against a candidate `RootChainManager`. It is excluded from the command
above by the `SkipCI` suffix in its test name, and from CI as well.

RPC endpoints default to Tenderly's keyless public gateways (see `[rpc_endpoints]` in
`foundry.toml`), so no API key is needed; export `MAINNET_RPC_URL` for a private endpoint.

> **Known issue:** the test currently fails with `MemoryOOG` — 5,215 replays in a single test
> exceed the EVM memory budget. It needs batching before it can be relied on.

### npm scripts

| Script | Does |
|---|---|
| `npm test` | Hardhat test suite |
| `npm run build` | `hardhat compile` |
| `npm run generate:interfaces` | regenerate `scripts/helpers/interfaces/` |
| `npm run testrpc` | anvil on port 9545 |
| `npm run fmt:js:check` / `fmt:js:fix` | Prettier over `scripts/` and `test/` |
| `npm run lint:js` | ESLint over `test/` |
| `npm run flatten` | `hardhat flatten` |

No Solidity linter or formatter is wired up: `forge fmt` cannot handle pre-0.8 sources, and every
contract here is pinned to `0.6.6`.

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

The check runs in CI on `master`, `main` and `dev`.

### The inventory

`scripts/pinning/pinned-contracts.json` is the source of truth; read its `_comment` for the full
field reference. It covers the managers, the eight token predicates, the immutable proxy shells
and the child-token code that many mapped tokens share. **Individual mapped tokens are out of
scope** — only immutable or shared code is tracked.

The inventory should stay fully green. If a contract needs to change ahead of a deploy, put the
change on its own branch and merge it when the deploy happens, rather than landing it on a
long-lived branch and marking the entry as drift. The verifier does support a `knownDrift` escape hatch — it reports
without failing, and flags the exemption as stale if the contract starts reproducing again — but
nothing uses it today, and it is meant for cases that cannot be resolved any other way.

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

The six reproduce from `UChildERC20Common.sol`, which is that build's verified source with its
flattened preamble swapped for imports of the identical modules already in the repo — the match
proves those modules are byte-for-byte what was inlined. `UChildERC20.sol` is the same contract
plus `changeName()` and cannot produce both.

They are six entries rather than one representative because the `liveness` pointer is per token:
if any of the six is upgraded to the current implementation, that entry goes `STALE_POINTER` and
gets removed, which one shared entry would quietly hide. The same build is what nearly every
mapped ERC20 on Amoy runs too — 19 of 20 sampled.

### Before editing a pinned contract

Four things will bite you:

- **The proxy shells can never be redeployed.** `UpgradableProxy` is held at the exact source
  the live shells were compiled from. Improving it silently breaks reproducibility for all
  twelve of them, so any change belongs in a new contract, not that one.
- **Compiler settings are per-contract, not global.** The predicates deployed in 2020-21 used
  optimizer runs 200; `RootChainManager` and `ERC20Predicate` were redeployed via Foundry in
  2025 at runs 999999 — both pinned per-path in `foundry.toml` so a plain `forge build`
  reproduces them. The proxy shells were deployed with the optimizer *off*, which Foundry's
  compilation restrictions cannot express, so the verifier builds those itself. Note that
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

## Deploying

Deployment is done with Foundry scripts under `scripts/forge/`, each with an
`input.json.example` showing the parameters it expects:

| Script | Purpose |
|---|---|
| `grant-role/` | grant a role on RootChainManager or a predicate |
| `transfer-ownership/` | move proxy ownership |
| `migrate-bridge-funds/` | move funds out of a predicate |
| `update-impl-timelock/` | swap an implementation via the Timelock |
| `update-impl-multisig/` | swap an implementation held directly by a multisig |

These broadcast real transactions and read the signing key from the environment:

```env
# Deployer private key — needs funds on the target chain
PRIVATE_KEY=
```

Broadcast records from past runs are kept under `broadcast/`.

> The previous Truffle/`matic-cli` migration flow documented here has been removed: it depended on
> `truffle-config.js`, a `migrations/` directory and an `npm run migrate` script, none of which
> exist any more. `git log` has the old instructions if you need them.
