# Draft persistence: independently measured stable chunk reuse

Candidate: [`cc841a7e47`](https://github.com/yuvrajvirk/opencode/commit/cc841a7e47ede3b602d20d82029c8e8cb201bc99), against upstream `863ea413649484b5761cd0c5c0e54c559a5c8b52`.

Start with [results and limitations](draft-persistence/RESULTS.md), the [pre-implementation protocol](draft-persistence/protocol.md), [selection decision](draft-persistence/SELECTION.md) and [pre-holdout freeze](draft-persistence/freeze.json). The actual inspiring feature and its parent are tested, seven alternatives are retained, and no production/scorer tuning follows heldout access.

- Heldout: 72 files / seven repository-disjoint repositories, 4,320 exact saves in every version. Large-edit submissions 186,731,138→71,878,991 bytes (61.5% lower); medium 10.3% lower; small unchanged.
- 140 heldout edit-byte wins, **20 losses**, 200 ties. All losses are appends, including 13/24 large cases; largest extra cost 15,270 bytes over ten saves. This is not a universal improvement.
- The final paired cost campaign avoids the earlier append slowdown, but **Node large same-width replacement is 10.1% slower**. No UI-latency claim from storage-boundary byte counts.
- Fresh remote four-checkout reproduction exactly matches every correctness, expected-document hash, byte/call count and retained-byte result. See [verification](draft-persistence/clean-reproduction-verification.json).
- 766 app units, 173 Happy-DOM browser-condition tests, six desktop SQLite draft tests, ten repeated draft-suite runs, and 34 canonical checks pass. No Windows or real Chromium E2E claim.

## Reproduce

Requires Git, Python 3, Node 22 and Bun **1.4.2**, with network access. From this branch's root:

```sh
python3 draft-persistence/reproduce.py \
  --candidate cc841a7e47ede3b602d20d82029c8e8cb201bc99 \
  --output /tmp/opencode-draft-reproduction \
  --split both
```

The output directory must not exist. This downloads immutable corpus archives, verifies their hashes, prepares both splits with the unchanged selector, fetches the four actual OpenCode revisions, installs each frozen dependency set with lifecycle scripts disabled, runs the actual DraftStore and scores the results. No corpus repository code or actual agent/model executes. `--archives /path/to/existing/archives` optionally reuses archives only after verifying their SHA-256 hashes. Output goes under the fresh directory, not into the evidence.

Raw logs and larger JSON records are compressed losslessly. To inspect or rescore the recorded runs:

```sh
find draft-persistence -name '*.gz' -exec gzip -dk {} +
```

The record includes historical BOM failures, initial-write and undo costs, all per-case regressions, three complete cross-engine cost campaigns, synthetic diagnostic probes, negative-proof attempts, normal test logs, clean reproduction logs, source patches and the independent expected-document hashes. Large generated fixture files and third-party corpus source are not redistributed: preparation recreates them from pinned archives with their original licenses. `artifact-hashes.json` hashes the published artifacts; freeze hashes identify the exact production and benchmark inputs. Timing observations are not expected to reproduce bit-for-bit.
