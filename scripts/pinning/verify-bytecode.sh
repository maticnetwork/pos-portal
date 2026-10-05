#!/usr/bin/env bash
# Verify that the repo's sources still compile to exactly the bytecode deployed on-chain for
# every core bridge contract in pinned-contracts.json — the managers, the predicates, their
# proxy shells and the shared child-token implementations. Mapped tokens are deliberately out
# of scope; only code that many tokens share is tracked.
#
# Usage: scripts/pinning/verify-bytecode.sh [chainid ...]   (default: all chains)
#
# Each contract is compiled with the compiler settings it was deployed with, into a per-setting
# out dir, then its deployedBytecode is compared against `cast code <address>`. See
# compare_bytecode.py for the comparison levels. Exit code 1 on any undocumented mismatch.
set -euo pipefail
cd "$(dirname "$0")/../.."

CONFIG=scripts/pinning/pinned-contracts.json
WORK=verify-onchain
mkdir -p "$WORK/build" "$WORK/onchain" "$WORK/liveness"

CHAINS=("$@")
if [ ${#CHAINS[@]} -eq 0 ]; then
  CHAINS=($(jq -r '.rpc | keys[]' "$CONFIG"))
fi

# Resolve a chain's RPC: the env var named in the config wins, otherwise the keyless default.
rpc_for() {
  local var default
  var=$(jq -r --arg c "$1" '.rpc[$c].env' "$CONFIG")
  default=$(jq -r --arg c "$1" '.rpc[$c].default' "$CONFIG")
  echo "${!var:-$default}"
}

# 1. Build each contract with the settings it was DEPLOYED with, not the repo defaults.
#    Contracts here span three optimizer configurations, and `runs` matters even when the
#    optimizer is off — solc still consults it when picking the function dispatcher, so the
#    proxy shells only reproduce at (enabled=false, runs<=200). Group by the full setting
#    tuple so one build serves every entry that shares it.
#
#    NOTE: `compilation_restrictions` in foundry.toml take precedence over the FOUNDRY_*
#    environment variables set below. Today the two agree (foundry.toml pins RootChainManager
#    and ERC20Predicate to runs=999999, which is what this script wants for them anyway), so a
#    wrong value there still surfaces as a MISMATCH rather than a false pass. But this script is
#    no longer fully independent of foundry.toml — if you add a restriction, check it against the
#    settings recorded in pinned-contracts.json.
: > "$WORK/build-failures.log"
for key in $(jq -r '[.contracts[] | select(.exclude != true)
                     | "\(.solc)_\(if .optimizer.enabled == false then "off" else "on" end)_\(.optimizer.runs // 200)_\(.evmVersion // "istanbul")"]
                    | unique | .[]' "$CONFIG"); do
  IFS='_' read -r solc enabled runs evm <<< "$key"
  echo "==> build group $key"
  for f in $(jq -r --arg k "$key" '[.contracts[] | select(.exclude != true)
               | select("\(.solc)_\(if .optimizer.enabled == false then "off" else "on" end)_\(.optimizer.runs // 200)_\(.evmVersion // "istanbul")" == $k)
               | .file] | unique | .[]' "$CONFIG"); do
    echo "==>   forge build --use $solc $f"
    if FOUNDRY_OUT="$WORK/build/out-$key" \
       FOUNDRY_CACHE_PATH="$WORK/build/cache-$key" \
       FOUNDRY_OPTIMIZER="$([ "$enabled" = on ] && echo true || echo false)" \
       FOUNDRY_OPTIMIZER_RUNS="$runs" \
       FOUNDRY_EVM_VERSION="$evm" \
       forge build --use "$solc" "$f" >/dev/null 2>"$WORK/.builderr"; then
      mkdir -p "$WORK/artifacts/$key"
      cp -R "$WORK/build/out-$key/$(basename "$f")" "$WORK/artifacts/$key/"
    else
      echo "BUILD FAILED ($key): $f" | tee -a "$WORK/build-failures.log"
      sed -n '1,6p' "$WORK/.builderr"
    fi
  done
done

# 2. Fetch on-chain runtime code (cached per address — bytecode at a fixed address is immutable,
#    so a cached hex file can never go stale).
for chain in "${CHAINS[@]}"; do
  rpc=$(rpc_for "$chain")
  for addr in $(jq -r --arg c "$chain" '.contracts[] | select(.chain == $c) | select(.exclude != true) | .address' "$CONFIG"); do
    out="$WORK/onchain/${chain}_$(echo "$addr" | tr 'A-F' 'a-f').hex"
    if [ ! -s "$out" ]; then
      echo "==> cast code $addr (chain $chain)"
      cast code "$addr" --rpc-url "$rpc" > "$out"
    fi
  done
done

# 3. Resolve liveness pointers. Bytecode at a fixed address is immutable, so comparing it can
#    never catch the system being re-pointed at a DIFFERENT address — a proxy upgrade leaves the
#    old implementation, and this check, perfectly green. So for entries
#    reached through a pointer, ask the live system what it points at now and require it to still
#    be the address we pin. NOT cached: this is the one value that can change.
for chain in "${CHAINS[@]}"; do
  rpc=$(rpc_for "$chain")
  while IFS='|' read -r addr target sig args; do
    [ -z "$addr" ] && continue
    out="$WORK/liveness/${chain}_$(echo "$addr" | tr 'A-F' 'a-f').addr"
    echo "==> cast call $target $sig $args (chain $chain)"
    # $args is intentionally unquoted: it is a space-separated argument list from the config.
    # shellcheck disable=SC2086
    cast call "$target" "$sig" $args --rpc-url "$rpc" >"$out" 2>/dev/null || echo "CALL_FAILED" >"$out"
  done < <(jq -r --arg c "$chain" '.contracts[]
             | select(.chain == $c) | select(.exclude != true) | select(.liveness)
             | "\(.address)|\(.liveness.target)|\(.liveness.sig)|\(.liveness.args // "")"' "$CONFIG")
done

# 4. compare
python3 scripts/pinning/compare_bytecode.py "$CONFIG" "$WORK" "${CHAINS[@]}"
