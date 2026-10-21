# Draft persistence feasibility: historical gate and current headroom

Status: seven prototypes evaluated; the seventh was selected and frozen at **2026-10-21T18:48:56.217Z**, then passed untouched heldout evaluation and exact fresh remote reproduction. Candidate `cc841a7e47ede3b602d20d82029c8e8cb201bc99` is pushed only to the fork's `codex/draft-chunks`, based on latest upstream `863ea413649484b5761cd0c5c0e54c559a5c8b52`. **No PR yet; evidence is being packaged.** Alternative patches and all unfavorable runs remain in this directory. No production/scorer changes followed heldout access.

## Frozen development content

The protocol predates preparation and any production implementation. All 64 development snapshots / 56 repositories remain represented. Independent path-hash selection gives **153 text files**: 64 small, 59 medium and 30 large, totaling 14,196,911 source bytes. Missing size bands are explicitly retained; no files are selected by their storage outcomes. Fixture SHA-256: `dcd7fa819f843241e41309ceab80e9be867aff21b34de075921c72f2e98f4fbf`.

Five predeclared editing profiles run against actual `createDraftStore`: append, prepend, middle insertion, middle deletion and same-width middle replacement. Each scenario includes initial persistence, ten edit saves and undo, with every committed document restored through a fresh real DraftStore and compared against independently constructed expected text. There are 765 scenarios / 9,180 possible exact saves. These are synthetic editing profiles over real public content, not observed composer-user frequencies.

## Actual inspiring feature gate

- Parent: `44513bd0b002edc79f5bd2a3f6b0d02d9d727744`.
- Original performance feature: `798b2b359a781d141808591ef53e9ac6a5cfbba4`, from #47706. Later bug-fix commits in that PR are not the inspiration.
- Initial measured baseline: `d10692ecb0aa827152b5c65ef76781869e758092`; refreshed baseline `bddf5346c8e3a0c7c662d231c5f3e302ae5f0b1f` has identical app source/dependencies and exact byte/outcome parity.
- All three checkouts independently install their own frozen dependencies with lifecycle scripts disabled. No actual model or source-repository code executes.

The parent restores **9,180/9,180** saves exactly. Original feature and latest each restore **9,120** saves, with **five failed scenarios** (one medium file across all profiles); the remaining 60 saves are not executed after the initial failed restoration. They are not replaced or counted as passing.

For the predeclared **large band**, all 30 files / 360 saves per profile are exact in all three versions. Document-plus-blob bytes submitted across the ten edit saves are:

| Large-content profile | Parent | Original feature | Latest |
| --- | ---: | ---: | ---: |
| Append | 123,115,280 | 9,488,840 | 9,488,840 |
| Prepend | 123,115,280 | 118,311,660 | 118,311,660 |
| Middle insert | 123,115,280 | 70,711,689 | 70,711,689 |
| Middle delete | 123,098,283 | 70,695,189 | 70,695,189 |
| Middle replace | 123,106,860 | 19,813,930 | 19,813,930 |

Thus the actual inspiring feature substantially improves storage work on the same independent benchmark, especially appends, while retaining considerable prepend/middle headroom. **This is not a regression-free historical gate.** The medium groups have an existing correctness failure and are explicitly marked invalid for efficiency comparison; their raw costs and errors remain in `development-score.json`. Small-content costs are unchanged. Do not silently remove the medium case to claim global exactness.

## Retained text-loss failure

`rayokota/jsonata-python`, `src/jsonata/signature.py`, begins with U+FEFF. Original feature and current chunk storage lose it on the initial fresh-store restoration. An independent local native diagnostic confirms `Blob.text()` strips a leading UTF-8 BOM: `bom-native-diagnostic.json`. This is a pre-existing failure exposed by the independent corpus, not a new bug-fix inspiration. All prototypes preserve the character with an explicit UTF-8 decoder and `ignoreBOM: true`; moving chunk boundaries must not silently drop internal text.

Any candidate that changes chunk boundaries must account for this boundary behavior rather than normalize expected text, discard the file or introduce new losses at internal U+FEFF characters. If restoring exact text requires a decoding change within the modified chunk boundary, justify it as necessary to preserve the new chunking contract, retain historical failures, and test the broader boundary. Do not turn this research into a standalone unrelated bug-fix PR.

## Limits and next decision

Storage uses an instrumented real content-addressed in-memory driver, not SQLite/IndexedDB. Counts reflect bytes crossing the driver boundary, not IPC wall time, disk fsync or user-perceived latency. Retained bytes are before collection, not final disk usage. Single-run elapsed values are exploratory; no timing win is claimed. All versions use the same runner hash and expected-document hashes.

App instructions prioritize stability and simplicity before performance. Reject a byte-saving scheme that creates significant UI-thread work or unbounded retained draft state. Freeze any selected candidate/scorer before preparing the existing 24-snapshot held-out split.

## Actual development alternatives

All seven prototypes restore 9,180/9,180 development saves, including the previously failing medium case. Large-band submitted edit bytes are below; all 30 files in that band are exact in every historical/current/prototype version.

| Variant | Append | Prepend | Middle insert | Middle delete | Middle replace |
| --- | ---: | ---: | ---: | ---: | ---: |
| Latest | 9,488,840 | 118,311,660 | 70,711,689 | 70,695,189 | 19,813,930 |
| Newline | 8,749,140 | 33,700,402 | 29,051,030 | 29,029,261 | 19,457,150 |
| Gear-like | 6,039,970 | 35,343,991 | 31,463,214 | 31,446,714 | 17,114,210 |
| Bounded newline | 8,749,140 | 33,700,402 | 29,051,030 | 29,029,261 | 19,457,150 |
| Digest cache | 8,749,140 | 33,304,405 | 28,608,486 | 28,625,395 | 19,457,150 |
| Weighted LRU | 8,749,140 | 33,304,405 | 28,608,486 | 28,625,395 | 19,457,150 |
| Pressure-aware hits | 8,749,140 | 33,304,405 | 29,012,352 | 29,029,261 | 19,457,150 |
| Terminal window too | 2,448,500 | 33,305,075 | 28,609,156 | 28,626,044 | 19,457,820 |

The simple newline version has unbounded backwards scans on long lines and is rejected. The gear-like version is more complex, scans per character, and does not outperform newline alignment on non-append byte volume. Bounded newline fixes scanning but exposes a cache cliff near 4 MiB: a synthetic repeated-append probe rises from 21,332,825 to 41,977,335 bytes. The digest cache fixes that cliff but adds repeated hashing overhead. Weighted LRU fixes it without extra hashing, reducing that probe to 75,565 bytes. Both caches cap logical text weight at the original 4 Mi UTF-16 characters per cache and cap entries at 128; this is a logical bound, not a precise JS heap-size claim.

Weighted LRU lowers large-band edit bytes 289,021,308→118,744,576 (58.9%), but is not a universal improvement: across all jointly correct scenarios there are 144 byte wins, 36 losses and 580 ties. Five other scenarios become correct and are not credited as efficiency wins. Worst per-scenario append losses include a notebook rising 356,665→587,295 bytes over ten saves. The full per-case records remain available; the headline does not conceal these losses. The supplementary 20-case synthetic diagnostic set is not heldout and includes retained 8 MiB cache-cap limits and no-newline regressions.

## Cross-engine cost veto under investigation

`cost-protocol.md` predates the campaign: one warmup pair and five alternating measured pairs per engine. Every one of 24 runs is checked for exact outcome, submitted bytes/calls, expected hashes and retained-byte parity against its original worker run. The v2 worker changes only runtime/path/revision reporting, not edits or the oracle.

Weighted LRU's large prepend/middle/delete median paired save-time ratios are 0.634/0.780/0.817 in Bun 1.4.2 and 0.562/0.753/0.663 in Node 22.23.3. However, Node medium append is slower in all five pairs (1.277, 1.218, 1.144, 1.002, 1.176), with median elapsed sums 47.43→55.26 ms over 580 edit saves. Large append median paired ratios are 1.049 Bun and 1.057 Node. **Do not claim no CPU regression or dismiss the repeated medium append result as noise.** Whole-process median peak RSS falls 711,684→619,204 KiB in Bun and 521,100→471,564 KiB in Node; these processes include fixture parsing, fresh-store assertions and reporting, not just renderer residency.

The pressure-aware experiment skips LRU reordering while there is room for another maximum-size entry. It is exact on all development/diagnostic observations but adds 807,732 development and 4,718,592 diagnostic edit bytes versus weighted LRU. Its complete same-protocol cost campaign passes all 24 parity checks, but does not give a consistent cost improvement: Node large append ratio is 1.131, Bun large replacement 1.111. It is rejected rather than selecting only favorable measurements. See `pressure-experiment.md`, `cost-pressure-summary.json` and `validation-notes.md`.

The seventh prototype returns to weighted LRU and applies the same bounded newline search to the terminal window as well, instead of suppressing it at EOF. This removes a branch and avoids re-uploading a large terminal chunk for new text after a stable newline. Development large append submissions fall 9,488,840→2,448,500 bytes. Across the 760 jointly exact development scenarios there are 177 edit-byte wins, 27 losses, 556 ties; five separately reported scenarios become correct. Initial submissions increase in 25 scenarios (3,015 bytes total), and 15 undo scenarios increase. No losses are filtered out. Synthetic diagnostics remain 100/100 scenarios exact; 14 of the 85 jointly exact scenarios submit more edit bytes than baseline. Initial, edit and undo breakdowns are in `comparison-terminal.json` and raw logs.

Its final-source cost campaign completes with all 24 parity checks passing. Medium append now improves in all five pairs in both engines (median ratios 0.718 Bun / 0.683 Node); large append is approximately even (0.983 / 0.998). Large prepend/middle/delete ratios are 0.653/0.769/0.792 Bun, 0.557/0.720/0.685 Node. **Node large replacement remains slower in all five pairs**, median ratio 1.101, elapsed sums 135.38→149.25 ms across 300 edit saves. This tradeoff is explicitly accepted before holdout, not discarded as noise or hidden in an average. See the immutable `SELECTION.md` and `freeze.json`.

Normal owning-module validation demonstrates all three added tests fail on the baseline and pass on the candidate. The Unicode negative proof uses native Blob bytes through the existing driver because Happy DOM's Blob.text() masks the defect; both initial unsuccessful negative attempts are retained. Seventh-prototype validation: full app unit suite **766 pass / 2,279 assertions**, full browser-condition suite **173 pass / 1,804 assertions**, desktop SQLite draft suite **6 pass / 23 assertions**, and **34 canonical checks**. The draft file passes ten repetitions concurrently with the full app suite (**190 pass / 610 assertions**). Browser-condition tests use Happy DOM, not a real Chromium E2E run; no Windows execution is claimed. Formatting/comment cleanup preserves every outcome and byte count exactly. After rebase on refreshed upstream, all 34 checks pass again without cache reuse. Full clean reproduction and evidence packaging remain before PR publication.

## Untouched heldout evaluation

Only after the freeze, the original preparation script selected all 72 eligible files across 24 snapshots / seven repository-disjoint repositories: 24 per band, 69 distinct content hashes, 8,578,702 bytes. No missing size bands. Fixture SHA-256 `93a6d55195f0412716e62b9269b2e5457800bcd613dff27554a26947b6ac3053`. All four actual versions restore **4,320/4,320** saves exactly. The final v2 worker also re-executes all four versions on development; current baseline now uses actual refreshed commit `863ea413...`, with exact byte/outcome parity against the earlier cost baseline.

| Heldout large-content profile | Parent | Inspiring feature / latest | Frozen candidate |
| --- | ---: | ---: | ---: |
| Append | 77,338,050 | 7,003,750 | 2,198,050 |
| Prepend | 77,338,050 | 73,989,410 | 19,028,315 |
| Middle insert | 77,338,050 | 44,891,266 | 17,223,864 |
| Middle delete | 77,324,387 | 44,877,972 | 17,477,282 |
| Middle replace | 77,331,300 | 15,968,740 | 15,951,480 |

Large-band edit submissions fall **186,731,138→71,878,991 bytes (61.5%)**. Medium falls **48,854,061→43,800,954 (10.3%)**; small is unchanged. Across all 360 heldout scenarios there are **140 edit-byte wins, 20 losses, 200 ties**, no correctness loss. All 20 byte losses occur on append: seven medium and 13 large cases. Largest loss is 15,270 bytes over ten saves for a matplotlib SVG; the other losses are smaller. Thus a majority of individual large append cases do not improve even though aggregate append bytes fall substantially; do not hide that distribution. Initial submissions are identical in all heldout cases; undo improves nine cases and loses none.

All frozen hashes were verified unchanged after evaluation. The candidate and focused review-base branch are on the fork only. `reproduce.py` completed in `/home/yvirk2/opencode-research/draft-persistence-clean-reproduction`: four actual code revisions fetched remotely, each frozen dependency set independently installed, and both splits independently prepared from SHA-verified cached archives. All eight version/split runs exactly match source/lock/worker/fixture/protocol hashes, correctness outcomes, expected-document hashes, submitted bytes/calls and retained bytes. Timing is deliberately not required to match. See `clean-reproduction-verification.json` and the retained clean-reproduction logs.
