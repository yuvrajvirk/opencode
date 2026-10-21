# Confined object-property interoperability evidence

This evidence is maintained on a separate branch of **yuvrajvirk/opencode**, not upstream. The production PR contains implementation, normal tests and the support checklist only; this branch contains reproducibility and complete favorable/unfavorable observations.

## Results

| Check | Before | After |
| --- | ---: | ---: |
| Actual inspiring feature #50834 vs its actual first parent | 256/2,862 | 437/2,862 |
| Latest measured CodeMode vs frozen candidate | 480/2,862 | 1,895/2,862 |
| Unopened-until-freeze MDN examples with native observations | 5/23 | 13/23 |

The historical gate has 181 gains and no losses. The current official suite has 1,416 gains and one explicitly retained confinement-boundary loss; 967 cases still fail. The heldout has eight gains and no losses. All 58 MDN fences remain reported; only 23 meet the pre-frozen observed-program rule. These are standard-library capability measurements, not actual-agent task accuracy. See [REPORT.md](REPORT.md) for scope, limitations, failed attempts, four actual implementation stages, supplementary mutation results and overhead diagnostics.

## Reproduce from GitHub

Prerequisites: Git, Bun 1.4.2, Node.js 22.23.3, network access and sufficient disk space for four independent worktrees/dependency installations. No model account is needed.

```sh
git clone --single-branch --branch codex/object-evidence https://github.com/yuvrajvirk/opencode.git object-evidence
cd object-evidence
bun reproduce.ts /absolute/path/to/new-output-directory
```

The output directory must not exist. The script fetches pinned historical/current OpenCode commits and pinned official Test262 sources, installs each checkout's frozen dependencies without lifecycle scripts, applies `candidate.patch`, checks frozen source hashes, regenerates fixtures, and runs the actual implementations. It then fetches the pinned MDN pages and runs native/baseline/candidate with the same frozen wrapper. All stdout/stderr and results remain in the output directory. The already completed clean run is summarized in `clean-reproduction/SUMMARY.json`.

No interpreter is mocked. The official harness runner has only a helper-loading addition to use the unchanged official `propertyHelper.js`; its hash is verified. Case source hashes are verified on every scored run. Project skip entries do not filter the independent benchmark. Native Node passes all 2,862 official fixtures.

The measured current baseline is `9c8e9e4bca433339e06aba8caf4c57b38f636ec9`; final patch SHA-256 is `9118d9cc96882a213f6b7dec1905e927054c78f6452124a69fe810c9c55a3510`. Source and scorer freeze metadata is in `holdout-freeze.json`. Later observed upstream `3108505b2fdd159ed3fb0ce78b6d340776391c35` changes no CodeMode source or dependency lockfile; results are not relabeled as a new full-suite run on that revision.

## Provenance and licenses

- OpenCode source/harness: [yuvrajvirk/opencode](https://github.com/yuvrajvirk/opencode), MIT license preserved as `LICENSE-OpenCode`.
- Official tests: [tc39/test262](https://github.com/tc39/test262/tree/250f204f23a9249ff204be2baec29600faae7b75), BSD-3-Clause. The reproduction downloads the pinned repository with its license and per-test attribution intact; fixtures are not bundled in this evidence branch.
- MDN examples: MDN contributors, [mdn/content](https://github.com/mdn/content/tree/615796ca0d6cbba67cc6576e8adf343700f8ab49). Each page URL/hash is recorded in `holdout-sources.json`; code fences are consumed verbatim by the reproduction. The complete MDN license notice is preserved as `LICENSE-MDN.md`, including CC-BY-SA 2.5 for prose and the applicable code-example licensing rules. Full pages/fixtures are downloaded by the reproduction rather than bundled here.

Historical prototype patches retain their original local-path headers and are audit records, not the reproduction input. Only the normalized final `candidate.patch` is applied by the reproduction script. Failed logs, unsupported cases and unfavorable costs have not been discarded.
