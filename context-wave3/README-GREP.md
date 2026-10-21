# Filename search: independent query-answer benchmark

This benchmark measures whether one real OpenCode grep call recovers the complete answer requested by a recorded repository-search command. It is **not an agent-completion or latency benchmark**.

## Run

On Linux with Git, Bun 1.4.2, Python 3.10+, GNU grep, and ripgrep 15.2.0 on PATH:

```bash
bash reproduce-grep.sh c7619fa2a09b26d3df324e0091171076917be8dc
```

The candidate commit is also recorded in `candidate.json` with the production source hashes frozen before heldout evaluation. The script downloads and SHA256-verifies 572,469,271 bytes of immutable repository archives, fetches four exact OpenCode revisions, installs each revision's locked core dependencies with lifecycle scripts disabled, and executes the actual registered grep tool. Allow approximately 10GB free disk and several minutes plus dependency downloads. Only one source snapshot is expanded at a time. No code from benchmark source repositories, recorded shell strings, `find -exec`, pipelines, substitutions, model calls, or credentials are executed/used.

The default run uses the frozen 52KB `grep-corpus.json`, not the large original trajectories. It runs all 88 requests once per revision, then two additional development-only rounds. The candidate is frozen before the single heldout evaluation. Raw tool results/logs, `grep-summary.json`, and the complete-answer paired comparison are generated alongside the scripts. Temporary HOME/XDG/TMP directories isolate ignore/configuration state; no `.git` directories are created in source snapshots. Resolved tool binary/version and locale are recorded in every result.

## Results

| Actual checkout | Exact requested sets | Wrong records | Tool errors |
| --- | ---: | ---: | ---: |
| Parent of #46716, `34e40cc4…` |72/88|0|0|
| Original #46716, `519cd8c7…` |75/88|0|0|
| Latest baseline, `4d596576…` |74/88|0|0|
| Frozen candidate |84/88|0|0|

The inspiring PR's independently occurring case-insensitive requests improve 7/10→10/10; requested line identities improve 44/98→98/98. Its exact-set gains are on line queries 6/9→9/9; filename queries remain 66/79. The candidate's gains are on filename queries 65/79→75/79, while line queries remain 9/9. These are distinct subsets of the same independently selected requested-search-answer completeness benchmark, not a claim that the original PR introduced or improved filename output. This is the required actual historical quality check, not a simulation that disables a flag in current code.

Candidate versus latest: filename requests65/79→75/79 exact; source/model/repository-disjoint holdout 20/24→23/24. Ten complete-set gains across nine repositories, zero complete-set losses. All six zero-result requests remain correct. The four remaining misses request more than the unchanged100-file limit; they are retained as failures, not excluded.

On the 74 requests where **both** implementations return the complete answer, normalized model-content bytes fall 124,632→28,228 (77.35% less). Different temporary directory prefixes are normalized to `/workspace`; raw byte counts are also retained. Incomplete answers never qualify for this byte-saving claim.

Ripgrep traversal order is unspecified. Earlier baseline runs recovered 75/88 instead of74/88 because a line-capped result happened to cover all files in one more request. Every sample is retained, and repeated development rounds characterize this variation; do not interpret arbitrary capped partial order as an algorithmic regression between historical revisions. The primary measurement is complete requested sets, with false positives/errors separately controlled.

## Independent data and oracle

The 88 requests come from pinned public OpenHands/SWE-rebench trajectories across 63 repositories. 79 explicitly request filenames (`grep -l`); 9 are line queries, including natural matching-option controls. Selection is SHA256 order, one query per task and a per-repository cap, before evaluating implementations. Development 64 and holdout 24 are disjoint by repository and trace source/model family. No literal or case-sensitive tasks were synthesized to make the original PR pass.

Requests are reconstructed on each task's immutable **base** revision, not the agent's modified intermediate working tree. The comparison deliberately shares Core's regular-file traversal conditions (`rg --files --hidden`, include glob, `.git` exclusion), while GNU grep independently evaluates content and produces expected filename/line identities. This is not a claim to reproduce arbitrary original shell traversal semantics. All selected patterns are in the GNU BRE/Rust-regex common subset. The independent audit verified all 88 raw-source commands, argument normalizations and paths, and found no relevant omitted-symlink readers or `.ignore`/`.rgignore` files.

GNU-I and Core JSON can differ on binary data in general. All 7,780 eligible NUL-containing file occurrences and 41 eligible NUL-free invalid UTF-8 occurrences were independently checked; none match any selected query under either engine. Thus the gold sets are equivalent for this corpus, without changing eligibility or silently deleting cases. See `GREP-PROTOCOL.md` and the independent review for scope and caveats.

## Alternatives and implementation

Three implementations were actually evaluated on development only: deduplicate existing bounded line results; JSON with max-count 1 per file; and native NUL-delimited filename output. The first retains line crowding. The latter two each recover 61/64 exact development answers.

Native output was selected because valid filenames do not depend on decoding matching content: JSON Match requires a UTF-8 line, while filename mode correctly handles a matching non-UTF8 file. Independent directory/explicit-file probes confirm no widening of binary traversal policy. A development-only uncapped engine-output diagnostic found identical filename sets 55/55, with 457,356 JSON bytes versus23,124 native bytes (94.94% less). This diagnostic is **not** a production runtime, memory or token claim.

Production changes are confined to the grep leaf, the existing ripgrep adapter, focused tests, and user documentation. Default content output is unchanged; the independent 33-case audit passes 120 assertions, including 9 exact default content/error comparisons, path escaping, permission denials, cancellation, flags and file limits. Public filesystem HTTP schemas are unchanged.

## Provenance and optional regeneration

- OpenHands evaluation outputs: MIT, `OpenHands/openhands-evaluation-outputs`, immutable Hugging Face revision `aa8977805b4cefd317001d80ddf1ad52790e9d23`; three pinned Claude 3.5 Sonnet, DeepSeekChat and GPT-4o runs listed in the corpus/source ledger.
- Nebius SWE-rebench OpenHands trajectories: CC-BY-4.0, attribution to Nebius/SWE-rebench authors, dataset `nebius/SWE-rebench-openhands-trajectories`, revision `35455389ab51bf5e2306bfd436ef72d0f98bf882`; first 1024 rows in published order, not outcome-selected.
- Nebius SWE-rebench task metadata: dataset `nebius/SWE-rebench`, revision `89cdfbab4ab1bd8f5a658bb212d1b63624f4f881`, filtered split used to resolve base commits.
- Source code archives remain under their original repository licenses; manifests provide immutable commits, download URLs, and SHA256 digests. No archives or full traces are redistributed in this evidence bundle.

Optional selection regeneration is separate from the one-command scorer because it requires large trajectory downloads and PyArrow/fsspec. In a separate copy of the evidence directory, install PyArrow24.0.0 and fsspec2026.4.0, then run `bash regenerate-grep.sh`. The research scripts `trace-survey.mjs`, `grep-survey.mjs`, `download-nebius.py`, `normalize-grep.py`, and `freeze-grep.py` preserve the complete selection procedure; raw-to-normalized mapping is in every frozen request. Corpus SHA256 is `d0400372543c08b81faef89ffcbcc8e2500cf8ec7b2fcc45f8a84b2ee738ca35`.

Limits: mostly Python repositories from public issue-resolution traces, restricted static command grammar, reconstructed base snapshots, no actual-agent completion claims, and no general assertion that every grep/Rust-regex or binary policy is equivalent. A task may require more than one call when more than 100 files match.
