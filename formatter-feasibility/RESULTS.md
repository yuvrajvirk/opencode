# Formatter interoperability: native-filter candidate and rejected prototypes

## Current state: held-out evaluation and clean reproduction passed

The frozen sixth candidate improves held-out exact outcomes **3→15/15**, with 12 gains in Django/pytest, zero losses and all 55 preservation controls unchanged. All 24 snapshots and 72 selected files remain represented, including two mutation limitations. Fresh remote reproduction regenerates byte-identical development/held-out fixtures and matches **10, 50, 10, 80/83** and **3, 15/15**, including every unfavorable historical case. Final focused validation is 63 tests / 82 assertions, all 34 canonical checks and 2,088/2,088 diagnostic filter decisions. See `REPORT.md` for complete current scope and costs. No production/scorer tuning followed the source freeze or held-out access.

## Sixth implementation development checkpoint, before held-out inspection

The sixth implementation replaces JavaScript regex translation with isolated native Python `re.search`, using constant code and JSON input. It neither executes project hooks nor imports project modules (`-I -S`). It prefers Python adjacent to the resolved Black executable, then PATH Python; missing Python, invalid filters, nonzero exits and a two-second timeout skip formatting without falling through to another formatter. Unfiltered declarations do not start Python. Filters use Git-root-relative paths, including when configuration is nested.

Actual v3 reruns on refreshed upstream `8a360e103e247f7ecb588cfeb24feb006baf14ca` confirm the inspiring feature's **10→50/83** and current-to-sixth **10→80/83**, with **70 gains across 23 repositories, zero losses and zero changed preservation controls (104)**. All 64 development snapshots remain represented. The remaining three misses are Faker's explicit tox command, not removed cases. See `development-score-v3.json` and `v3-{before,original,latest,candidate}.log`.

The unchanged supplementary 2,088-case filter audit now passes **2,088/2,088**, zero unsupported or wrong decisions (`regex-audit-native-refreshed.json`). This audit was developed after earlier prototypes, so it is not claimed as an untouched holdout. Four actual-process controls pass: project module shadows are not executed, verbose-filter text remains data, invalid regex skips, and pathological backtracking times out at 2,008.5 ms. A fifth isolated-PATH control confirms missing Python skips. Ordinary control decisions took about 18–28 ms locally; an extra Python process for explicitly filtered files is a real cost, not a speed improvement. Windows has not been executed here.

The refreshed candidate passes 62 focused tests / 81 assertions, core typechecking and 34 canonical workspace checks. A final pre-freeze review against pre-commit's native classifier found that an explicitly empty `types_or` means unrestricted; this has been corrected and a unit invariant added. Final-source reruns are separate artifacts, not silently substituted for the already measured source.

Before any held-out inspection, the independent oracle gained native `identify` file tags, original source modes, explicit-empty exclusion handling, and retained unsupported/native-timeout outcomes. All **192 selected IDs, paths, input/expected bytes and hashes, native commands, exit codes and stderr remain unchanged** (`oracle-v3-parity.json`). Only metadata changes. V3 fixture SHA-256 is `6216d299a537bf8d7aa48ad308f4a1544585913e2c781ea2f746e4f4dcbc947c`. The four actual v3 runs use the same runner hash `468e247b5a4d9d529b9474cfd8e49702fd1d3f5a73bde77af2a4e1e0b74e2245` and original outcome contract. Five unusable mutation fixtures and every unfavorable historical result remain visible.

No formatter PR or push yet. Final source, scorer and preparation hashes must be frozen before opening the 24 held-out snapshots. No production tuning is allowed after opening them. The following sections retain the earlier rejected-prototype history; their original status statements are historical, not the current state.

## Archived fifth-prototype status

Status: ongoing investigation, **no selected implementation and no PR**. The original held-out 24 repository snapshots remain unopened. The isolated `codex/black-formatter` worktree now contains an uncommitted fifth prototype based on `ab249a9684f60179b5ebe0bb401b23fa0988e733`. All earlier prototypes are retained as patches and scored logs. The latest prototype is not publishable: a supplementary Python-regex differential audit exposes incorrect file-filter decisions despite its favorable development score.

## Independent frozen benchmark

Before production edits, the contract selected three actual Python files per development snapshot by a formatter-independent path hash. All 64 snapshots / 56 repositories remain represented: 192 selected files, including five files with no eligible mutation token. Those five are retained as explicit fixture limitations rather than replaced with easier examples.

The single whitespace perturbation preserves the complete token type/string sequence. Pinned native Black 24.1.0 and Ruff 0.11.13 supply exact expected output using source project configuration and explicitly declared formatting options. Both executables are available in an isolated PATH; uv/other formatters are absent. No source-repository code, hook or dependency installation is executed. This measures local formatter interoperability, not historical CI-version parity or agent-task completion.

- 83 usable independently expected outcomes: 77 Black and six Ruff.
- 81 require a change to the perturbed input; two are policy-excluded/no-op cases.
- 104 additional usable no-declaration/ambiguous cases are preservation controls, not ground-truth successes added to the primary denominator.
- All native oracles complete without a formatter error. The five unsupported fixtures are separate and visible.
- Each OpenCode version executes 187 files through its real formatter path with its own frozen dependencies. Historical checkouts initialize `Format` and publish the real `File.Event.Edited`; modern checkouts activate actual configuration plugins and call `Formatter.file`.
- Formatting is explicitly enabled in all tested versions. This does not claim an effect when OpenCode formatting is disabled.

Fixture SHA-256: `ea9cf19a2bdb7587890f7ff6117f27d0ad609050d5280164cb1c183212dadbc0`.
Contract SHA-256: `c0684b823a6bd868666a4197e29e09ae244802ce2660015fbadfa67f25d08bd2`.

## Actual historical quality gate

| Actual version | Exact / 83 | Exact among changed-input cases / 81 |
| --- | ---: | ---: |
| Feature first parent `b848b7ebae7b783ae5dc121f1c865f17da453543` | 10 | 8 |
| Original Black feature `9d0f88e60463cc1de5b1e5e586b9f8fcdf98ac4c` | 50 | 49 |
| Latest measured baseline `870ab9dc5f2eb97c82024f56278f168353a0b068` | 10 | 8 |

The real inspiring feature improves the frozen primary outcome count **10→50**, with 41 gains across 14 repositories and one loss. The loss is a PennyLane documentation file excluded by its Black hook: the built-in runs Black without that hook exclusion. The feature also changes six preservation controls in PyGMT and SQLGlot by treating incidental `black` text as activation evidence. These unfavorable results are retained, not described as a regression-free historical improvement.

The PR's final merge head is deliberately not used as the historical comparison: its first parent already contains the feature. Both actual gate commits and their own source hashes are recorded in `development-score.json` and the raw logs.

## Three actual implementations compared

| Prototype | Exact / 83 | Gains vs latest | Losses vs latest | Changed preservation controls / 104 |
| --- | ---: | ---: | ---: | ---: |
| Literal port of original dependency-substring detection | 50 | 41 | 1 | 6 |
| Explicit Black TOML section only | 41 | 32 | 1 | 0 |
| Explicit section plus recognizable official Black hook declaration | 73 | 64 | 1 | 0 |

All three use the actual current formatter runtime and the same frozen inputs. They retain existing Ruff-first precedence; that still misses projects using Ruff for linting and Black for formatting. The hook prototype also ignores hook arguments and file filters. No prototype is presented as a complete project-style implementation.

The highest-scoring heuristic was then checked against two additional **post-prototype** negative fixtures: a valid TOML multiline documentation string containing `[tool.black]`, and a valid YAML scalar containing an apparent Black hook while the real `repos` array is empty. Independent TOML/YAML parsers confirm neither declares a formatter. The latest baseline correctly leaves both files unchanged (**2/2**); the hook heuristic formats both incorrectly (**0/2**). These are added validation probes, not a claimed untouched holdout. The entire original benchmark remains unchanged.

Thus the heuristic is rejected despite its favorable aggregate score. It has not been pushed, committed, or proposed in a PR. Selecting the narrower section regex merely to obtain a simpler passing change is also inappropriate: it misses real source declarations and still confuses TOML strings with tables.

## Fourth and fifth implementations: parser compatibility is not policy compatibility

The actual refreshed baseline `ab249a9684f60179b5ebe0bb401b23fa0988e733` still scores 10/83, identical to the earlier baseline, with no changed controls. The fourth implementation uses structured TOML/YAML parsing, native Black arguments, per-file resolution, and an explicit skip result to avoid falling through to Ruff for excluded files. It scores **71/83**, including 69/81 changed-input cases, with 61 gains, zero losses and zero changed preservation controls. Both supplementary string/scalar negative probes pass.

The fourth parser rejects two real development configurations accepted by the independent PyYAML oracle: Pydicom uses a duplicate root mapping key, and PyVista has unindented flow-sequence contents. The fifth alternative uses `js-yaml` 4.3.1 with its documented last-key-wins option. It scores **77/83**, including 75/81 changed-input cases: 67 gains across 22 repositories, zero losses and zero changed controls. Both parser negatives still pass. All 187 usable files execute through the actual runtime with no reported runtime errors. Six missed primary outcomes remain: three Aesara files with Python verbose-regex filters, and three Faker files whose formatting declaration is in tox.

Focused validation passes **58 tests / 77 assertions** and core typechecking. This is not a claim of full workspace checks. The lock audit finds no removed distinct locked package records and only one newly introduced record, `smol-toml@1.9.1`; other lock changes are hoisting/alias relocation of versions already present. Direct dependencies are still a real maintenance cost. Source and lock hashes are recorded in each new raw run.

Crucially, the fifth candidate's apparent regression-free corpus result is insufficient. A new **post-prototype**, non-held-out differential audit uses Python 3.13's actual `re.search` as oracle over 36 patterns and 29 paths, testing both inclusion and exclusion. It includes source-derived filters and independent standard syntax, Unicode names, whitespace, anchors and character classes. Actual production `BlackFormatter.command` yields:

| Filter audit result | Cases / 2,088 |
| --- | ---: |
| Correct decisions | 1,480 |
| Explicit unsupported results | 406 |
| Incorrect accepted decisions | **202** |

For example, JavaScript accepts `\\A` as an identity escape rather than Python's start anchor, producing the wrong exclusion decision. Unicode classes and character-class syntax also differ. Treating only JavaScript compilation exceptions as unsupported is therefore unsound. These are not hidden-holdout failures or model-task measurements. The candidate is **not selected or published**. Do not merely remove difficult patterns, narrow the original intent, or call the 77/83 score sufficient. A maintainable solution must delegate or accurately preserve project filter semantics; otherwise defer this whole contribution.

## Oracle correction before held-out inspection

The original oracle applied hook-level but omitted root-level pre-commit filters. `prepare-v1.py` and the original fixture remain preserved. Revised `prepare.py` includes both levels and writes a distinct `development-fixtures-v2.json`, never replacing the frozen original by default. A complete re-generation verifies **all 192 selected file records identical**, including every input byte, expected byte, native exit code and stderr; only root-filter declaration metadata is added. Thus all existing historical/current/prototype scores remain valid on exactly the same outcomes, not retrospectively relabeled cases. The three nonempty root-filter declarations are recorded in `oracle-v2-parity.json`.

Original fixture SHA-256 remains `ea9cf19a2bdb7587890f7ff6117f27d0ad609050d5280164cb1c183212dadbc0`; revised metadata-bearing fixture is `651724068cfdef15cb524f6e62eab4fc30015ed72a0921a65bcd2fb9ceeeee48`. The original contract is unchanged. Any eventual held-out preparation must use the corrected oracle and still retain unsupported/error cases rather than replacing them.

New artifacts: `variant-{structured,compatible}.patch`, matching `.log` files, `latest-current.log`, `probes-{structured,compatible}.log`, `compatible-{install,typecheck,tests}.log`, `compatible-lock-audit.json`, `regex-audit.py`, `regex-audit.ts`, `regex-audit-fixtures.json`, `regex-audit-compatible.json`, and `oracle-v2-parity.json`. The regex harness exercises the production command resolver with real filesystem services, not copied detection logic. Native full-file formatting evidence remains in the main actual-runtime benchmark.

## Earlier fourth-implementation plan (implemented, not selected)

A further candidate needs structured TOML/YAML parsing, rather than text matching, and must separate explicit formatter selection from merely installed lint tools. Respect static official-hook formatting options and path filters without executing hooks or installing project dependencies. Unsupported or ambiguous declarations must not be guessed. This direction adds real complexity and must justify its dependency/API cost against the corpus and native output oracle before publication.

The current internal `Info.enabled` is a directory-level Effect, with successful commands cached per formatter. Supporting file filters through mutable closure state would be fragile. A possible cleaner extension is an internal per-file resolver alternative that bypasses command caching while leaving existing static formatter behavior and explicit user overrides intact. This is a design option, not an implemented or selected solution; inspect all consumers before changing the type.

Use the three rejected implementations as comparisons. Do not open held-out configurations or score them until the fourth candidate, scorer and unit invariants are frozen. If reliable discovery requires an overly broad pre-commit integration or cannot be maintained cleanly, defer this intent rather than publish a brittle benchmark-optimized feature.

## Artifacts and reproduction status

- `protocol.md`, `benchmark-contract.md`, `survey.py`, `prepare.py`, `requirements.txt`: selection, exact configuration provenance and native oracle construction.
- `development-configs.json`, `development-fixtures.json`, `development-fixture-summary.json`: frozen development inputs and all fixture limitations.
- `before.log`, `original.log`, `latest.log`, `variant-{literal,configured,hook}.log`: every actual OpenCode outcome.
- `variant-{literal,configured,hook}.patch`: all rejected production implementations, based on the measured latest revision.
- `score.mjs`, `development-score.json`, `score-{literal,configured,hook}.log`: independent hash-based rescoring, gains, losses and changed controls.
- `make-probes.py`, `post-prototype-probes.json`, `probes-{latest,hook}.log`: negative parser validation.
- `checkouts/{before,original,latest}`: actual historical/baseline trees with own locked dependencies.
- Local Python environment is Python 3.13.14; exact installed versions are in `requirements.txt`. No model/account calls were used.

The worker gained an optional fixture-path argument only for the two supplemental probes; default corpus behavior and fixture bytes did not change. Current worker SHA-256 is `952e357c3c8f0166939472cc80c674b524aafc7001bfc36337bcf1a9bd1b5f3d`. The original scored logs precede that argument-only extension. No canonical production check or new unit suite is claimed for the rejected prototypes; their evidence is actual benchmark execution plus the supplemental failure probes.
