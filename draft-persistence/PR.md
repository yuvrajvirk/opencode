## Intent

Reduce repeated writes when editing large multiline drafts, without changing the persisted format or weakening recovery. This extends the large-draft persistence improvement in upstream #47706; it is not a bug-fix inspiration.

Prefer a nearby newline within a bounded 32–64 Ki-character window, including the terminal window. Retain the fixed-size fallback and surrogate-pair protection. Weight the two LRU caches by text size so shorter chunks do not halve their useful capacity. Preserve U+FEFF on decoding because changing boundaries must not discard text. No dependency or migration.

## Independent evidence

[Protocol, all seven alternatives, raw results and reproduction](https://github.com/yuvrajvirk/opencode/tree/codex/draft-evidence).

The benchmark selects files by path hash from an existing immutable repository cohort, not by chunking outcomes: 153 development files / 56 repositories and 72 heldout files / seven other repositories. Five fixed edit profiles each perform initial save, ten edits and undo, checking the complete expected document through a fresh actual DraftStore after every save. Scores count document-plus-blob bytes at the storage boundary, not UI latency. Edit frequencies are synthetic, not user-traffic estimates.

**Required historical quality check:** actual feature commit `798b2b359a` versus its actual parent `44513bd0b0` improves large-development append submissions **123,115,280→9,488,840 bytes**, and middle-insertion submissions **123,115,280→70,711,689**. Existing historical BOM losses are retained rather than filtered out.

Candidate and scorer were frozen before opening heldout files. Against latest upstream `863ea41364`:

| Heldout large drafts: ten edit saves | Before bytes | After bytes |
| --- | ---: | ---: |
| Append | 7,003,750 | 2,198,050 |
| Prepend | 73,989,410 | 19,028,315 |
| Middle insert | 44,891,266 | 17,223,864 |
| Middle delete | 44,877,972 | 17,477,282 |
| Same-width replacement | 15,968,740 | 15,951,480 |

**61.5% fewer large-draft edit bytes; 4,320/4,320 heldout restores exact in both versions.** Medium improves 10.3%; small is unchanged. Across all heldout scenarios: 140 byte wins, 20 losses, 200 ties. All losses are appends, including 13/24 large cases; the largest is 15,270 extra bytes over ten saves. Initial writes are unchanged; undo has no losses. Development has 177 wins / 27 losses and five separately corrected scenarios, with all 9,180 candidate restores exact.

## Costs and validation

- Seven actual alternatives retained; unbounded scanning, cache cliffs, repeated hashing and a less effective cache fast path were rejected.
- One warmup + five alternating pairs per engine, Bun 1.4.2 and Node 22.23.3. Medium append improves in every pair; large append is approximately even. Large prepend/middle/delete save time improves in both engines. **Node large same-width replacement is 10.1% slower** (135.38→149.25 ms across 300 saves). No universal speedup claim. Whole-process peak RSS falls, but this includes fixture loading and recovery assertions.
- Full app units: 766 pass; browser-condition suite: 173 pass; desktop SQLite draft tests: six pass; 34 canonical checks. Three new tests fail on baseline; the draft test file passes ten repetitions concurrently with the full app suite. Browser-condition tests use Happy DOM, not Chromium; no Windows claim.
- Production/scorer hashes stay unchanged after heldout access. Fresh four-checkout remote reproduction exactly matches every outcome, expected-document hash, submitted byte/call count and retained-byte count on both splits; verification and raw logs accompany the evidence.

Actual production source is identical between the recorded cost campaign and the final rebased candidate. Cost logs retain their actual baseline revision `bddf5346c8`; the intervening upstream changes affect only unrelated AI files. Final correctness/byte runs use `863ea41364` directly.
