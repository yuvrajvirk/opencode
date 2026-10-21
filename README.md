# Python formatter interoperability evidence

Evidence for automatic project-style formatting in OpenCode, maintained on a separate branch of **yuvrajvirk/opencode**, not upstream.

| Exact final-file outcomes | Before | After |
| --- | ---: | ---: |
| Actual inspiring feature #19016 vs its first parent | 10/83 | 50/83 |
| Latest measured OpenCode vs selected implementation | 10/83 | 80/83 |
| Repository-disjoint held-out examples, frozen before access | 3/15 | 15/15 |

Current improvement: 70 development gains across 23 repositories, 12 held-out gains across Django/pytest, zero lost primary cases and all 159 preservation controls unchanged. A clean remote reproduction matches every score and control. All six alternatives, historical losses, unsupported fixtures and costs remain documented. The original feature was an unmerged feature PR, not a bug fix.

See [the report](formatter-feasibility/REPORT.md) for independent selection/native-oracle details and limitations. This is exact local formatting interoperability, **not** agent-task completion or a speed benchmark. Primary scores cover usable formatter oracles, not all 264 selected files. Seven mutation limitations remain visible. Linux tested; Windows not executed. No account/model calls are required.

## Reproduce

Requires Git, Bun 1.4.2, Node 22.23.3, `uv`, network access and space for four independent checkouts/dependencies plus about 547 MiB of repository archives. The output directory must not already exist.

```sh
git clone --single-branch --branch codex/formatter-evidence https://github.com/yuvrajvirk/opencode.git formatter-evidence
cd formatter-evidence
bun formatter-feasibility/reproduce.ts /absolute/path/to/new-output
```

The script downloads/verifies immutable archives, regenerates byte-identical fixtures, fetches the actual historical/current commits, installs locked dependencies without lifecycle scripts, applies the frozen patch, verifies production hashes and runs every actual formatter path. No source-project setup, hooks, Python code or recorded trajectory commands execute. Raw stdout/stderr and every failure remain retained. Completed clean-run evidence is in [clean-reproduction](formatter-feasibility/clean-reproduction).

`selected-freeze.json` records production, tests, lock, protocol/preparation/scorer hashes before held-out access. No production tuning follows. The later PR documentation entry does not change those bytes; the reproduced `candidate.patch` remains the exact frozen implementation/test/dependency patch. Earlier prototype patches are archival alternatives, not inputs to the final reproducer.

## Provenance

- OpenCode source: [yuvrajvirk/opencode](https://github.com/yuvrajvirk/opencode), MIT; license preserved in `LICENSE-OpenCode`.
- The repository cohort comes unchanged from an earlier independently frozen search benchmark. [Original provenance](context-wave3/README-GREP.md) identifies pinned OpenHands evaluation traces (MIT) and Nebius SWE-rebench trajectories (CC-BY-4.0, attribution to Nebius/SWE-rebench authors). The copied cohort retains all attribution/source fields; it is used here only for repository revisions and the original split, not search outcomes.
- Each source archive URL/hash is in `context-wave3/snapshot-manifest.json`. Reproduction downloads the complete archive, preserving project licenses and attribution. Full project code, configurations and generated full-file fixtures are **not bundled** in this evidence branch.
- Python-regex semantics follow native [pre-commit filtering](https://github.com/pre-commit/pre-commit/blob/8cb5845c835b1ff72240eb2484239411ec481d92/pre_commit/commands/run.py); source is referenced, not redistributed here. Native Black, Ruff and Python dependencies are pinned in `requirements.txt` and retain their installed licenses.

`artifact-hashes.json` records packaged research artifact hashes. README links are navigation, not additional benchmark claims.
