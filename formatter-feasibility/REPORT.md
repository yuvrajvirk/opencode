# Honor explicitly declared Python formatting policy

Status: selected implementation passes development and untouched-until-freeze held-out evaluation. A fresh remote reproduction exactly matches every headline score, gain/loss count and preservation control. Publication targets `yuvrajvirk/opencode` only.

Published as [fork PR #11](https://github.com/yuvrajvirk/opencode/pull/11), production commit `76401aa6543a85a7ddf366ac869a00d7a31fbf5e`. The base branch pins the measured baseline so the review contains only eight intended implementation/test/dependency/documentation files, not unrelated upstream changes.

## Intent and change

OpenCode's automatic formatter selection should produce the locally declared project style after an edit. Merely having Ruff installed does not mean a project uses Ruff for formatting; many use it for linting alongside Black. Explicit custom formatter commands already work. This change adds automatic discovery of an explicit Black TOML section or a single official Black pre-commit hook, forwarding supported static formatting options and respecting path/type filters. It preserves explicit command overrides and existing fallback behavior for unsupported/ambiguous declarations.

The implementation parses TOML and YAML rather than searching source text. A per-file resolver permits different inclusion decisions for files in one session; an explicit skip prevents excluded files falling through to Ruff. Python regex semantics are delegated to isolated native Python with JSON input, not translated to JavaScript. No project hooks, project modules or dependency setup execute.

## Independent outcome evidence

The cohort was selected previously for repository search, without formatter outcomes: 88 immutable snapshots from 63 repositories. The existing split is repository- and source-disjoint: 64 development snapshots / 56 repositories, 24 held-out snapshots / seven other repositories. Three Python files per snapshot are selected by path hash, never by formatter success. A token-preserving whitespace perturbation makes formatting observable. Installed native Black 24.1.0 and Ruff 0.11.13 independently produce expected bytes from original configuration and formatting options. The scorer checks exact final bytes, not selected commands or a particular implementation.

| Actual runtime comparison | Before | After | Gains / losses |
| --- | ---: | ---: | ---: |
| Inspiring feature #19016, actual first parent → actual feature commit | 10/83 | 50/83 | 41 / 1 |
| Latest measured OpenCode → selected candidate, development | 10/83 | 80/83 | 70 / 0 |
| Same frozen code, previously unopened held-out snapshots | 3/15 | 15/15 | 12 / 0 |

Historical commits are `b848b7ebae7b783ae5dc121f1c865f17da453543` and `9d0f88e60463cc1de5b1e5e586b9f8fcdf98ac4c`. The inspiring PR is an unmerged feature, closed by automated age cleanup; its final merge-head parent already contained the feature, so that incorrect comparison is not used. Historical OpenCode initializes its actual formatter service and edited-file event. Current OpenCode activates actual configuration plugins and calls `Formatter.file`. Each checkout uses its own locked dependencies. There is no copied formatter implementation in the scorer.

Development gains span 23 repositories. All 104 usable preservation controls are unchanged. Of 192 selected files, five have no eligible mutation token; these remain reported, not replaced. There are 83 usable independent oracles (77 Black, six Ruff); 81 require input changes, with exact changed-input outcomes improving 8→78. The remaining three primary misses are Faker's explicit tox command. Historical feature losses include a hook-excluded PennyLane documentation file, plus six changed preservation controls in PyGMT and SQLGlot; these are retained.

Held-out results preserve every snapshot and all 72 selected files. Two Sphinx files have no eligible mutation token. Fifteen files have independently usable formatter oracles across five snapshots from Django, pytest and Astropy; all require input changes. Gains are six Django and six pytest files; Astropy's three outcomes already pass. All 55 usable preservation controls are unchanged. Thus 15/15 is **not** a claim of 72 newly formatted files, seven gaining projects or broad unseen-language coverage. There are no runtime or native-formatter errors in either split.

## Selection and quality checks

Six real alternatives scored 50, 41, 73, 71, 77 and 80 out of the same 83 development oracles. Their patches and raw favorable/unfavorable observations are retained. The earlier text-matching implementation failed both parser-negative controls. A structured-parser implementation then passed the real-file cases but incorrectly accepted 202 Python regex decisions in a supplementary 2,088-case audit. It was rejected despite a superficially good 77/83 score.

The selected native-filter implementation passes all 2,088 audit cases, with zero unsupported or incorrect decisions. This is a post-prototype diagnostic, not an untouched holdout. Actual-process controls verify project module shadows stay unexecuted, filter text remains data, invalid filters skip, pathological backtracking times out, and unavailable Python skips.

The oracle was hardened before held-out access to handle root filters, native file tags, source modes and explicit-empty exclusions. All 192 development IDs, paths, input/expected bytes, native commands, exit codes and stderr remained identical; parity artifacts document this. Source, tests, lockfile, preparation, scorer and protocol were frozen at `2026-10-21T17:52:59.509Z` in `selected-freeze.json`, before held-out survey or execution. No production or scorer tuning follows held-out access. A final pre-freeze review corrected empty `types_or` to match native pre-commit semantics; that invariant is included in the frozen tests.

## Validation and costs

- Focused normal suite: **63 pass, zero fail, 82 assertions**; core typecheck passes; canonical workspace check **34/34**. This is not a full Core unit-suite claim.
- Measured baseline: `8a360e103e247f7ecb588cfeb24feb006baf14ca`. Later observed upstream `d10692ecb0aa827152b5c65ef76781869e758092` changes only agent/CLI documentation; no formatter, runtime or lockfile changes. Results are not relabeled as a full run on that later commit.
- New direct dependencies: `smol-toml` and `js-yaml`, plus YAML types. Existing locked versions remain available after hoisting; the lock audit records the package changes.
- Explicitly filtered hooks require a native Python process. Ordinary supplementary controls took roughly 18–41 ms across two local runs; this is a cost diagnostic, not a speed claim. Pathological regex evaluation stopped at about two seconds and skipped formatting. Unfiltered declarations do not launch Python.
- The local Black environment's Python is preferred; fallback is PATH Python. No Python means filtered hooks skip rather than risk wrong formatting. Installed Python semantics, not arbitrary historical pre-commit interpreter versions, apply.
- Linux was executed; Windows was not. No agent/model calls or account credentials were used for these tests. The cohort is Python-heavy, and local formatting correctness does not establish overall agent-task success.

## Reproduce

Prerequisites: Git, Bun 1.4.2, Node 22.23.3, `uv`, network access and enough disk space for four checkouts/dependencies and source archives. `reproduce.ts` takes a **new** output directory. It downloads full pinned source archives including their licenses, verifies hashes, installs only the pinned oracle tools, regenerates identical fixtures, fetches actual OpenCode commits, applies the frozen candidate patch, checks production hashes, and independently runs all four development implementations plus both held-out implementations. It never executes source-project code/setup/hooks. All raw outputs and errors are retained.

```sh
bun formatter-feasibility/reproduce.ts /absolute/path/to/new-output
```

Candidate patch SHA-256: `ee0fe472a4df95a484c4db8b1e48675a127055266141adf701a1395263a4d4cc`. Development fixture SHA-256: `6216d299a537bf8d7aa48ad308f4a1544585913e2c781ea2f746e4f4dcbc947c`. Held-out fixture SHA-256: `56148bed6a20fdc65336daf64a436b84dc87356dc784ab2774137c2f2413b717`.

The clean run downloads and verifies all 88 source archives, regenerates both fixtures with identical hashes, and independently fetches/installs all four OpenCode trees. It reproduces 10, 50, 10, 80/83 development scores and 3, 15/15 held-out scores, including every historical loss and all unchanged current controls. See `clean-reproduction/SUMMARY.json` and the retained raw logs. Subsequent user documentation adds only the Black formatter description/table entry; frozen production, tests, package and scorer bytes remain unchanged. `candidate.patch` intentionally remains the exact frozen, clean-reproduced code/test/dependency patch; documentation is separately represented in the PR.
