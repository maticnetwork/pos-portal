#!/usr/bin/env python3
"""Compare locally compiled runtime bytecode against on-chain runtime bytecode.

Invoked by verify-bytecode.sh. For each inventory entry it reads
  - the forge artifact from <work>/artifacts/<buildkey>/<File>.sol/<Artifact>.json
  - the cached on-chain code from <work>/onchain/<chain>_<address>.hex

Comparison levels:
  MATCH              byte-for-byte identical
  MATCH_NO_META      identical after stripping the trailing CBOR metadata blob
                     (source was reformatted/commented but compiles to the same logic)
  MISMATCH           logic bytecode differs; both stripped blobs are dumped to <work>/diffs/
  STALE_POINTER      the live system no longer points at this address (see 'liveness')
  POINTER_UNRESOLVED the liveness call could not be read at all — usually a flaky RPC, NOT
                     evidence of drift. Kept distinct from STALE_POINTER so a transient
                     failure is never mistaken for a real proxy upgrade, and vice versa.
  NO_CODE            address has no code on-chain
  MISSING_ARTIFACT   local build did not produce the expected artifact
  KNOWN_DRIFT        entry carries 'knownDrift' and does differ, as documented. Not a failure.
  DRIFT_RESOLVED     entry carries 'knownDrift' but now MATCHES. Also not a failure, but the
                     flag is stale and should be deleted — otherwise a future real drift on
                     this contract would be waved through.

Everything except MATCH, MATCH_NO_META, KNOWN_DRIFT and DRIFT_RESOLVED exits non-zero.

Library deployments have their own address embedded at byte offset 1 (PUSH20),
which is masked on both sides. Unresolved link references are masked the same way.
"""

import json
import os
import re
import sys


def strip_metadata(code: bytes):
    """Split trailing CBOR metadata (solidity appends <cbor><2-byte length>)."""
    if len(code) < 4:
        return code, b""
    length = int.from_bytes(code[-2:], "big")
    if length + 2 > len(code):
        return code, b""
    meta = code[-(length + 2):]
    # sanity: solidity metadata is a small CBOR map starting with 0xa1/0xa2/0xa3
    if meta[0] not in (0xA1, 0xA2, 0xA3):
        return code, b""
    return code[: -(length + 2)], meta


def mask(code: bytearray, start: int, length: int):
    code[start : start + length] = b"\x00" * length


def mask_embedded_metadata(code: bytearray) -> int:
    """Zero metadata hashes embedded mid-stream (factories carry the creation
    code of child contracts, which ends in its own CBOR metadata blob)."""
    markers = [
        (b"\xa2\x65\x62\x7a\x7a\x72\x30\x58\x20", 32),  # bzzr0 (solc <= 0.5.11)
        (b"\xa2\x65\x62\x7a\x7a\x72\x31\x58\x20", 32),  # bzzr1 (solc 0.5.12+)
        (b"\xa2\x64\x69\x70\x66\x73\x58\x22", 34),      # ipfs  (solc 0.6+/foundry default)
    ]
    hits = 0
    for marker, hash_len in markers:
        start = 0
        while (pos := bytes(code).find(marker, start)) != -1:
            mask(code, pos + len(marker), hash_len)
            start = pos + len(marker) + hash_len
            hits += 1
    return hits


def build_key(c: dict) -> str:
    """Directory name for the build group this entry belongs to. Must mirror
    the key verify-bytecode.sh builds under.

    'runs' is part of the key even when the optimizer is disabled, and that is not
    redundant: solc still reads it when choosing the function dispatcher, so
    (off, runs=200) and (off, runs=999999) produce different bytecode for the same
    source. The proxy shells only reproduce at (off, runs<=200)."""
    o = c.get("optimizer", {})
    return "{}_{}_{}_{}".format(
        c["solc"],
        "on" if o.get("enabled", True) else "off",
        o.get("runs", 200),
        c.get("evmVersion", "istanbul"),
    )


def main():
    config_path, work = sys.argv[1], sys.argv[2]
    chains = sys.argv[3:]
    cfg = json.load(open(config_path))
    results = []

    for c in cfg["contracts"]:
        if chains and c["chain"] not in chains:
            continue
        if c.get("exclude"):  # legacy / not pinnable to current source — see note
            continue
        entry = {k: c[k] for k in ("chain", "name", "address", "artifact", "solc", "file")}
        entry["build"] = build_key(c)

        # Pointer liveness (fetched by verify-bytecode.sh step 3). If the live system no longer
        # points at the address we pin, that address still holds the same immutable bytecode, so
        # comparing it would pass while telling us nothing about what is actually deployed. Report
        # the drift instead; the fix is to repoint the inventory and re-run.
        if c.get("liveness"):
            live_path = os.path.join(work, "liveness", f"{c['chain']}_{c['address'].lower()}.addr")
            resolved = open(live_path).read().strip() if os.path.exists(live_path) else ""
            if not re.fullmatch(r"0x[0-9a-fA-F]{40}", resolved):
                # No address came back (RPC error, reverted call, sentinel from the shell). This is
                # a failure to CHECK, not a detected drift — do not cry proxy upgrade.
                entry["status"] = "POINTER_UNRESOLVED"
                entry["points_at"] = resolved or "(empty)"
                entry["liveness"] = c["liveness"]
                results.append(entry)
                continue
            if resolved.lower() != c["address"].lower():
                entry["status"] = "STALE_POINTER"
                entry["points_at"] = resolved
                entry["liveness"] = c["liveness"]
                results.append(entry)
                continue

        src_base = os.path.basename(c["file"])
        art_path = os.path.join(
            work, "artifacts", build_key(c), src_base, c["artifact"] + ".json"
        )
        onchain_path = os.path.join(
            work, "onchain", f"{c['chain']}_{c['address'].lower()}.hex"
        )

        if not os.path.exists(art_path):
            entry["status"] = "MISSING_ARTIFACT"
            results.append(entry)
            continue

        art = json.load(open(art_path))
        local_hex = art["deployedBytecode"]["object"].removeprefix("0x")
        onchain_hex = open(onchain_path).read().strip().removeprefix("0x").lower()

        if not onchain_hex:
            entry["status"] = "NO_CODE"
            results.append(entry)
            continue

        # mask placeholders for unresolved library links on both sides
        local_b = bytearray.fromhex(local_hex.replace("_", "0").replace("$", "0"))
        onchain_b = bytearray.fromhex(onchain_hex)
        for refs in art["deployedBytecode"].get("linkReferences", {}).values():
            for sites in refs.values():
                for site in sites:
                    mask(local_b, site["start"], site["length"])
                    if site["start"] + site["length"] <= len(onchain_b):
                        mask(onchain_b, site["start"], site["length"])
        if c.get("isLibrary") and len(local_b) > 21 and len(onchain_b) > 21:
            mask(local_b, 1, 20)  # deployed libraries embed their own address here
            mask(onchain_b, 1, 20)

        if local_b == onchain_b:
            entry["status"] = "MATCH"
        else:
            stripped_local, local_meta = strip_metadata(bytes(local_b))
            stripped_onchain, onchain_meta = strip_metadata(bytes(onchain_b))
            # embedded child-creation-code metadata (factories) is metadata too
            local_logic, onchain_logic = bytearray(stripped_local), bytearray(stripped_onchain)
            mask_embedded_metadata(local_logic)
            mask_embedded_metadata(onchain_logic)
            if local_logic == onchain_logic:
                entry["status"] = "MATCH_NO_META"
                entry["meta_local"] = local_meta.hex()
                entry["meta_onchain"] = onchain_meta.hex()
            else:
                entry["status"] = "MISMATCH"
                entry["len_local"] = len(local_logic)
                entry["len_onchain"] = len(onchain_logic)
                first_diff = next(
                    (i for i, (a, b) in enumerate(zip(local_logic, onchain_logic)) if a != b),
                    min(len(local_logic), len(onchain_logic)),
                )
                entry["first_diff_offset"] = first_diff
                tag = f"{c['chain']}_{c['artifact']}"
                os.makedirs(os.path.join(work, "diffs"), exist_ok=True)
                for suffix, blob in (("local", local_logic), ("onchain", onchain_logic)):
                    with open(os.path.join(work, "diffs", f"{tag}.{suffix}.hex"), "w") as f:
                        f.write(blob.hex())

        # A documented drift is expected to differ. Reclassify so it reports without failing —
        # and flag the inverse case, where the drift is gone and the exemption is now stale.
        if c.get("knownDrift"):
            entry["knownDrift"] = c["knownDrift"]
            if entry["status"] == "MISMATCH":
                entry["status"] = "KNOWN_DRIFT"
            elif entry["status"] in ("MATCH", "MATCH_NO_META"):
                entry["status"] = "DRIFT_RESOLVED"

        results.append(entry)

    # Verifying nothing is not success. A typo'd chain filter or an inventory that lost its entries
    # would otherwise report a clean run, which is the one way this script could lie.
    if not results:
        sys.exit(
            f"error: no inventory entries matched (chains requested: {', '.join(chains) or 'all'})"
        )

    os.makedirs(work, exist_ok=True)
    with open(os.path.join(work, "results.json"), "w") as f:
        json.dump(results, f, indent=2)

    width = max(len(r["name"]) for r in results) + 2
    print(f"\n{'CONTRACT':<{width}}{'CHAIN':<7}{'BUILD':<26}STATUS")
    print("-" * (width + 60))
    rank = {
        "MISMATCH": 0,
        "STALE_POINTER": 1,
        "MISSING_ARTIFACT": 2,
        "NO_CODE": 3,
        "POINTER_UNRESOLVED": 4,
        "DRIFT_RESOLVED": 5,
        "KNOWN_DRIFT": 6,
        "MATCH_NO_META": 7,
        "MATCH": 8,
    }
    for r in sorted(results, key=lambda r: (rank[r["status"]], r["chain"], r["name"])):
        extra = ""
        if r["status"] == "MISMATCH":
            extra = f"  (len {r['len_local']} vs {r['len_onchain']}, first diff @{r['first_diff_offset']})"
        elif r["status"] == "STALE_POINTER":
            extra = f"  ({r['liveness']['sig']} now returns {r['points_at']})"
        elif r["status"] == "POINTER_UNRESOLVED":
            extra = f"  (could not read {r['liveness']['sig']} on {r['liveness']['target']} — retry)"
        elif r["status"] == "KNOWN_DRIFT":
            extra = f"  ({r['knownDrift']})"
        elif r["status"] == "DRIFT_RESOLVED":
            extra = "  (now reproduces — delete the knownDrift flag)"
        print(f"{r['name']:<{width}}{r['chain']:<7}{r['build']:<26}{r['status']}{extra}")

    ok = ("MATCH", "MATCH_NO_META", "KNOWN_DRIFT", "DRIFT_RESOLVED")
    bad = [r for r in results if r["status"] not in ok]
    exact = [r for r in results if r["status"] == "MATCH"]
    meta_only = [r for r in results if r["status"] == "MATCH_NO_META"]
    drift = [r for r in results if r["status"] in ("KNOWN_DRIFT", "DRIFT_RESOLVED")]
    print(
        f"\n{len(results)} checked: {len(exact)} exact, {len(meta_only)} metadata-only diff, "
        f"{len(drift)} documented drift, {len(bad)} problems"
    )
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
