# Project formatter interoperability: feasibility protocol

This is a feasibility investigation, not a completed benchmark or improvement claim. No production implementation has been written. The selected intent is honoring explicitly declared project formatting conventions after source mutations, not rewarding smaller files or any particular formatter implementation.

## Feature inspirations

- OpenCode #19016 is an unmerged feature adding automatic Black formatter discovery. It was closed by automated age/reaction cleanup, not a recorded technical rejection. Its final head is a merge whose first parent already contains the feature; do not mistake that merge for the historical quality gate. Locate and execute the original feature commit `9d0f88e604` and its actual first parent.
- OpenCode #39564 (`94ee274aebf62834a13cde697d7e0f728f6ef284`) adds the V2 formatter runtime. It is a possible broader inspiration if extending runtime interoperability rather than only Black. Do not claim either numerical historical gate until the actual historical implementations have run.
- Current baseline for any future comparison: upstream `870ab9dc5f2eb97c82024f56278f168353a0b068`. Current built-ins include Ruff and uv but not Black. Custom commands already work; no claim that Black is impossible to configure manually.

## Independently selected source cohort

Reuse every immutable repository snapshot from the already frozen repository-search cohort, which was selected without formatter outcomes. It contains 88 snapshots across 63 repositories, predominantly Python issue-resolution projects. This is a scoped cohort, not a claim of representing all languages or all GitHub projects.

- Input: `../context-wave3/grep-corpus.json`, SHA-256 `d0400372543c08b81faef89ffcbcc8e2500cf8ec7b2fcc45f8a84b2ee738ca35`.
- Archives: `../context-wave3/snapshot-manifest.json`, SHA-256 `335d46da90bccefa30845040e4a9eecb94a72ec58a8b49ce1369e4a9d9b6f060`.
- Development: all 64 snapshots from 56 repositories.
- Held out: all 24 snapshots from seven other repositories, preserving the original source/model/repository separation. Do not inspect their configuration contents or run formatter outcomes before an implementation and scorer are selected.
- Preserve archive hashes, repository licenses and original cohort provenance. Source repositories are data, not executable setup scripts. Do not run their hooks, install their dependencies or execute their Python source.

## First-stage survey (development only)

Verify each development archive against the existing manifest. Inspect only regular configuration files named `pyproject.toml`, `Pipfile`, `setup.cfg`, `.pre-commit-config.yaml`, `tox.ini`, or `requirements*.txt`, retaining exact bytes and paths. Distinguish explicit formatter sections and pinned pre-commit hooks from dependencies, comments, incidental substrings and lint-only Ruff use. A keyword occurrence is only a survey signal, not the expected answer.

Count distinct projects and snapshots with relevant declarations before choosing whether an extension is substantial. Retain no-declaration and competing-formatter projects as controls; do not select only Black-positive repositories. If real coverage is sparse, or correct preference requires guessing unsupported policy, defer instead of padding synthetic cases.

## Requirements for a later benchmark

If the survey establishes worthwhile headroom, freeze exact case identities, project declarations, precedence rules and expected outcomes before implementation. Use installed, pinned native formatters as an independent final-byte oracle, alongside unchanged/no-declaration and competing-formatter controls. A native formatter conformance suite alone does not test OpenCode's discovery or mutation integration. Exercise actual OpenCode formatter/mutation paths and separate automatic-selection coverage from formatter output correctness. Do not score the already-clean repository files as proof that a formatter ran.

The scorer must permit multiple implementations rather than prescribe detection code. Compare alternatives on development only; retain the frozen held-out repository split until selection. Actual inspiring commit versus actual first parent must improve the same benchmark. Native formatting does not establish agent-task success, and no model/account calls are required for this candidate.
