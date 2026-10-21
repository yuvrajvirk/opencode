# Frozen formatter outcome contract

This contract follows development-only configuration review and precedes native formatter evaluation, historical OpenCode execution and any production implementation. The original held-out repositories remain unopened.

## Scope and cases

Use all 64 development snapshots, then the previously frozen 24 held-out snapshots only after selection. For each snapshot, sort regular `.py`/`.pyi` files between 64 and 65,536 bytes by SHA-256 of `repo@revision:path`; select the first three. Do not replace a selected file if parsing, transformation, formatting or execution fails. Retain all such outcomes.

Copy the original selected files and all previously specified configuration files to an isolated temporary repository. No project setup script, plugin, dependency or Python source is executed. Apply one deterministic whitespace-only perturbation: surround the first `=` or `,` operator token with three extra spaces on each side. Verify that the complete token type/string sequence is identical before and after; token positions are not semantic. Retain files without a usable token or with tokenization failures as unsupported fixtures, not silently replaced easier cases.

## Independent intended-output oracle

The score is exact final bytes, not whether a particular OpenCode helper or executable was used. Native Black 24.1.0 and Ruff 0.11.13, with recorded transitive Python dependencies, supply the formatter-output oracle. Both are installed for every case; uv and other formatters are absent from the execution PATH. Git and Bun remain available for actual OpenCode initialization. This is an explicitly scoped local formatter environment, not an all-installed-formatters or pre-commit-version compatibility claim.

Determine the intended formatter from independently parsed project declarations:

1. A single explicit Black or Ruff-format pre-commit hook determines the formatter, including its static formatting arguments and file inclusion/exclusion constraints. Two competing formatter hooks are ambiguous and become preservation controls, not guessed labels. No hooks are executed.
2. Without such a hook, an explicit Ruff `format` configuration determines Ruff formatting. This includes dotted TOML keys, not only a literal `[tool.ruff.format]` header. The Falcon development snapshot expressly says its Black section is only defensive compatibility, and invokes Ruff formatting in tox; this rule agrees with that source evidence.
3. Otherwise an explicit `[tool.black]` in `pyproject.toml` determines Black. `setup.cfg` sections and isort's `profile = black` are not automatically Black configuration.
4. The development Faker snapshot explicitly invokes `black --check --line-length 120` in tox; its independent oracle uses Black with that line length. Other merely mentioned tools, documentation dependencies and unspecified styles remain preservation controls.

The native oracle reads the real configuration from the corresponding paths. Hook arguments are data passed only to the pinned formatter with a checked allowlist; shell interpolation, arbitrary hook commands and dependency installation are prohibited. Hook-excluded paths have unchanged intended bytes. Native formatter failures remain reported and outside the usable-oracle denominator; they are never replaced with successful files. Record native exit codes and stderr.

This tests conformance to the locally installed formatter plus recorded project options, not exact historical CI versions, all hooks in a project, syntax validity of every archived fixture, or overall agent success.

## Scoring and controls

- Primary: exact mutated-file final bytes among all cases with a usable independently intended output. Report separate Black/Ruff/excluded-file counts and distinct repositories gaining/losing cases.
- Do not count an unformatted original file as evidence of automatic formatting: retain whether the oracle changes the perturbed input, and separate native no-op cases.
- Preservation: on ambiguous/no-declaration cases, require the candidate to preserve the latest OpenCode final bytes and execution status. These are differential controls, not independent ground-truth successes added to the primary score.
- Run actual historical OpenCode formatter initialization plus edited-file event, and the actual current Formatter service/mutation path, each with its own locked dependencies. No simulated switch or copied production detection logic supplies historical scores.
- Required historical pair: `b848b7ebae7b783ae5dc121f1c865f17da453543` to feature `9d0f88e60463cc1de5b1e5e586b9f8fcdf98ac4c`. A failure to improve means this inspiration does not pass the quality gate.
- Compare actual alternatives against the same development inputs. Preserve all outcomes, even for rejected approaches. Freeze selected source before held-out inspection/evaluation. If the effort is not substantial or the oracle is too convoluted to defend, defer rather than publish.

The old feature's 19-line implementation is not a license to assume it satisfies the broader intent: it ignores pre-commit-only declarations and defers to Ruff even when Ruff is used for linting alongside explicit Black formatting. Such misses remain in the benchmark.
