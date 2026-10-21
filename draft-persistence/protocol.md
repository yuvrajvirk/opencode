# Draft persistence: feasibility protocol, before implementation

## Intent and historical gate

Reduce storage/transport work while editing a large draft, preserving exact recoverability and failure semantics. Inspiration: the performance/improvement commit `798b2b359a781d141808591ef53e9ac6a5cfbba4` from OpenCode #47706, not the later bug-fix commits in that PR. Compare that actual commit with its actual first parent; do not simulate the original feature by toggling current code. The benchmark is useful only if this historical feature improves its measured storage work.

The existing feature explicitly documents a remaining limit: edits in the middle of a paste shift later fixed-size chunk boundaries. A new contribution must materially improve realistic non-append edits **without** hiding append/short-text costs, relaxing durability, adding unbounded retained draft state, or claiming user-facing speed from transport-byte counts alone. No production implementation or selected algorithm exists yet.

## Independent content cohort and selection

Reuse the unchanged 88 immutable repository snapshots from the earlier repository-search cohort. This cohort was selected before formatter or draft outcomes: 64 development snapshots / 56 repositories, and 24 held-out snapshots / seven other repositories, disjoint by source and repository. This is public code/document content suitable for pasted drafts, not a trace of actual composer users. Never imply these synthetic edit frequencies represent observed user traffic.

Verify `../context-wave3/grep-corpus.json` SHA-256 `d0400372543c08b81faef89ffcbcc8e2500cf8ec7b2fcc45f8a84b2ee738ca35` and archive-manifest SHA-256 `335d46da90bccefa30845040e4a9eecb94a72ec58a8b49ce1369e4a9d9b6f060`. Archives are inert data; do not execute repository code, hooks or setup. Retain complete archives and licenses locally, and publish URLs/hashes rather than copying full source fixtures into production.

Per snapshot, choose at most one regular UTF-8 file in each of three byte-size bands: [1 KiB,16 KiB), [16 KiB,128 KiB), [128 KiB,2 MiB]. Eligible files have no NUL bytes and exact UTF-8 decoding. Sort by SHA-256 of `repo@revision:path`, choose the first in each band. Retain absent bands explicitly; never replace cases because a formatter, storage layer or implementation dislikes their content. Do not inspect held-out file contents until candidate and scorer freeze. Size stratification is deliberate; report each band separately, not a falsely representative aggregate user workload.

## Fixed edit profiles

Each profile starts with an independent store and a persisted initial document `{prompt:[{type:"text",content:source}]}`. Ten successive saves model batched typing, not ten isolated keystrokes. At each save independently construct the expected text from the prior text using the specified operation; all positions are UTF-16 offsets adjusted away from surrogate-pair interiors.

1. Append the next five-character ASCII string (`00001` through `00010`) at the end.
2. Insert the same five-character strings at the beginning, advancing the cursor after each insertion.
3. Insert them at the initial middle position, advancing the cursor.
4. Delete the next five characters at the initial middle position per save, adjusting the deletion endpoint to preserve code points.
5. Replace a ten-character range at the initial middle position with `edit-00001` through `edit-00010` (same replacement width), preserving code-point boundaries.

After each profile, save the original text again as an undo/restore control. Report initial persistence, ten edit saves and final undo separately. Do not combine positions in a way that hides an append regression. Additional synthetic Unicode, no-newline, repeated-line, failure/retry and collection/recovery probes may be added as explicit diagnostics, not counted as untouched real-content holdout gains.

## Actual runtime and independent scoring

Call the actual `createDraftStore` in each historical/current checkout with its own locked dependencies. Use its normal encoded-document API when present and the actual older `setItem(JSON.stringify(document))` API otherwise, matching the feature's caller change. No copied chunking/detection implementation supplies results.

Instrument the public storage-driver boundary with a content-addressed in-memory sink that really stores and retrieves blobs and serialized documents. It must implement strict reference availability checks, including both image and text references. Count UTF-8 document bytes and Blob bytes crossing this boundary, calls, stored unique bytes and expected-document restoration. SHA-256 supplies stable blob IDs; never assume a candidate's chunk count, size or boundary arrangement. Restore each committed document through a fresh actual DraftStore and compare its decoded complete document with independently constructed expected data. Reproduction is allowed to use any implementation producing the same observable document.

Primary efficiency scores: document-plus-blob submitted bytes per profile, and retained unique blob/document bytes after identical operation sequences, conditional on **every save/restore being exact**. Report driver-call counts as explanatory diagnostics, not a desired implementation. Separate initial upload costs and single-document edit deltas. The sink is not SQLite/IndexedDB; no claim of disk fsync, IPC latency or end-user responsiveness follows from these bytes.

Measure actual save-path elapsed/CPU and process memory separately with warmups and alternating paired repetitions. If a byte improvement adds unacceptable UI-thread work or memory, reject it or investigate another implementation. The original app prioritizes stability, simplicity, then performance. No timer thresholds in normal unit tests.

## Selection and publication rules

First verify the actual inspiring commit improves the same frozen development benchmark versus its parent. If not, reject this benchmark/inspiration. Then measure latest upstream and several real candidate implementations without changing benchmark case selection or expected results. Retain every failure and unfavorable scenario. Freeze selected production source, dependencies, preparation, scorer and edit protocol before preparing the held-out split; no tuning after held-out access. Run normal storage/draft tests and stronger failure/collection/undo controls before publication. Actual-agent tests, if later needed, use only the user's permitted local account/model; none are needed for deterministic persistence measurement.
