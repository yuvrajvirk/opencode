# Confined object-property interoperability: feasibility gate

Status: **production candidate validated against official tests and an unopened-until-freeze MDN holdout; fresh four-checkout GitHub reproduction matches every headline result**. This is a different intent from the deferred formatter investigation. Publication remains fork-only.

## Inspiration and independent scope

Feature [OpenCode #50834](https://github.com/anomalyco/opencode/pull/50834) adds object construction/prototype inspection and integrity operations to confined Code Mode. Its actual source explicitly leaves property-descriptor APIs unsupported. The broader measurable intent is executing ordinary JavaScript object construction, inspection and integrity operations without escaping confinement—not adding an API merely to pass a synthetic presence check.

Before scoring, `protocol.json` fixes the actual historical first parent, feature commit, current baseline, corpus selection and scorer. The corpus is all of `built-ins/Object/` in official Test262 revision `250f204f23a9249ff204be2baec29600faae7b75`. The project's existing flags/features/boundary rules remain, except allowing descriptor API calls and the unchanged official `propertyHelper.js`. This yields **2,862 selected non-negative test files from 3,411**, with every excluded file/reason recorded. Accessor-descriptor cases, arrays, functions, unrelated failures and tests that already pass are retained; the suite is not filtered to a proposed implementation.

No test source is rewritten. The identical existing OpenCode Test262 runner is used in three actual checkouts, extended solely to load the verbatim helper when a test requests it. Original runner SHA-256 in all three checkouts was `28daec109e1cd254cdd54b261d4963d5488d35342ed25bc29185d26a91d087e1`. The same patched-runner hash and each checkout's lock hash are recorded in the raw results. Each checkout installed its own frozen dependencies; production source is unchanged.

Fixture aggregate SHA-256: `00c72d332bf5b86dcadea228265901f4148a4840f859eb9a1787915cf152d0b0`.

## Actual historical quality check

| Actual implementation | Passed / 2,862 |
| --- | ---: |
| First parent `bee5014f89cef6233ee42d3e9b16f0b9473df05a` | 256 |
| Inspiring feature `318a8c1aba8a2b1ff8348b2de459ff924e8d84b3` | 437 |
| Latest fetched baseline `9c8e9e4bca433339e06aba8caf4c57b38f636ec9` | 480 |
| Native Node.js 22.23.3 control | 2,862 |

The actual inspiring feature adds **181 passing tests, zero lost tests**, meeting the required historical quality gate. The native control runs every selected official test in an isolated VM context and passes all; no native failures are discarded. These are conformance-test counts, **not** percentages of real agent tasks or all JavaScript support. Although there are no `negative`-metadata tests, ordinary official tests can assert expected TypeErrors; missing APIs can incidentally satisfy some such assertions. Preserve those cases and do not call every existing pass evidence of API availability.

Baseline example groups: `create` 31/279, `defineProperty` 47/1,030, `defineProperties` 40/585, `getOwnPropertyDescriptor` 2/292, `getOwnPropertyDescriptors` 1/11, `getOwnPropertyNames` 2/32.

## Actual alternatives and current candidate

Current ordinary objects already store data-slot attributes and native accessor pairs. Array elements instead share a single attribute record while their values live in a confined backing array. A descriptor feature must not bypass existing freeze/seal/non-extensibility checks, expose native closures, allow tool-reference inspection, or weaken cycle/resource controls.

The retained implementations use the existing confined backing array, not a second property store that can drift from native mutators. Four actual stages were exercised; raw patches, outputs and failed validations remain in this directory:

| Implementation | Passed / 2,862 | Gains / losses vs latest |
| --- | ---: | ---: |
| `native-backing`: eager native attribute reads, original shared integrity flags | 1,885 | 1,406 / 1 |
| `lazy-backing`: preserve ordinary-array read fast path, numeric coercion and byte updates | 1,895 | 1,416 / 1 |
| `native-integrity-final`: native backing-array integrity and mutation enforcement, no duplicated shared flags | 1,895 | 1,416 / 1 |
| `virtual-string`: bounded, on-demand primitive-string descriptors | 1,895 | 1,416 / 1 |
| Final formatted source, unchanged throughout holdout | 1,895 | 1,416 / 1 |

The candidate enables data-property creation, redefinition and inspection, including `Object.create`'s descriptor argument. It preserves inherited descriptor conversion order, all-input conversion before `defineProperties` mutation, per-index array attributes, array-length numeric conversion, and byte clamping. Existing native accessors are returned as confined callable wrappers with stable identity, never host functions. Primitive-string single-property lookup does not allocate one slot per UTF-16 unit; enumeration retains the existing array-size cap. No dependency is added.

Program-defined getter/setter functions and array accessor descriptors remain unsupported. Ordinary empty accessors are supported. The candidate does not add native eval, Function, Proxy, host-object visibility, or tool-reference inspection. Native getters are synchronous, whereas user callbacks execute through Effect; full user-defined accessors would require a separate architectural change, not just accepting a function in a descriptor. All unsupported official and held-out cases remain scored, rather than narrowing the suite to data properties.

Final groups include `create` 156/279, `defineProperty` 608/1,030, `defineProperties` 363/585, `getOwnPropertyDescriptor` 262/292, `getOwnPropertyDescriptors` 9/11 and `getOwnPropertyNames` 24/32. **967 of 2,862 official cases still fail.** These are capability/conformance gains, not an agent-task accuracy or performance claim.

### The one lost test is retained

`built-ins/Object/create/15.2.3.5-4-300.js` assigns top-level `this` to a purported setter and expects a TypeError because the native global object is not callable. Confined top-level `this` is deliberately `undefined`, making `{set: undefined}` a valid empty accessor. Baseline passed incidentally because it rejected all descriptor arguments. Do not expose a global object or reject valid empty accessors to improve this number. The independent benchmark retains the loss. The project's normal skip list documents that confinement boundary, and a focused unit test proves it explicitly.

### Validation and failed attempts

- Final stock suite before two additional confinement tests: **14,830 pass, 1,603 skip, zero fail**, 2,646 assertions; all **34 canonical workspace checks pass**.
- Removed **101 existing stock Object skip entries** that now pass. The independent scorer ignores the skip list entirely. It was not edited to exclude unfavorable benchmark cases.
- Two additional confinement tests verify all three reflective APIs reject tools/pending promises, and reflected getters retain receiver checks and blocked dynamic construction. The 12-test focused file passes **120 repeated executions, 310 assertions**. `safety-tests.log` contains the result. The subsequent complete stock suite passes **14,832 tests, 1,603 skips, zero failures and 2,665 assertions** (`full-tests-safety.log`).
- First prototype had one obsolete assertion expecting every `Object.create` descriptor to fail; updated for the new capability. The lazy prototype had a Slot union type error, fixed before selection. Initial native-integrity had an overloaded-native-call type error and six engine-specific TypeError message mismatches. The latter assertions now still require TypeError and exact mutation results, rather than a particular Bun message. Raw failed logs remain.
- Final production hashes are in `formatted.json` and `holdout-freeze.json`, and match the held-out candidate results. The stock Test262 runner is restored byte-for-byte; the research helper-enabled runner is untracked and must not enter the production PR.

## Supplementary mutation and cost audits

The post-prototype mutation audit fixes 208 operation sequences covering ordinary objects, arrays, typed arrays, attribute combinations, each mutator, and an empty accessor. Fixture SHA-256: `93a1f02f8c04fbfeac6aa769a36a69d83a75154dad70b7b2ae1fcbb4208e9081`.

- **194/208 match native Bun 1.4.2**, zero oracle errors. All 166 non-typed-array sequences match both Bun and Node.
- **166/208 match Node 22.23.3**. All 42 typed-array sequences differ between the native engines because Bun and existing CodeMode reject sealing nonempty typed arrays; Node permits it.
- Fourteen Bun mismatches concern ordinary assignment to typed-array keys `-0` or `4294967295`. Three old-API-only controls prove the baseline and candidate already share these assignment/sealing differences. They are not erased or represented as new descriptor conformance.
- `legacy-controls.json` and both native-engine results preserve exact observations. Original mistaken runtime metadata called Bun's Node compatibility version a Node runtime; preserved original metadata and corrected rerun explicitly report Bun 1.4.2 versus actual Node 22.23.3.

`array-cost.json` is a **synthetic regression diagnostic**, not independent usage evidence or a headline speed claim. Five fixed existing-API programs each have three warmups and nine alternating paired rounds of ten executions, with every output checked against native execution. Median paired candidate/baseline time ratios: ordinary indexed reads/writes **0.983**, callback pipeline **0.969**, sealed writes **1.033**, frozen reads **1.052**, array mutators **0.976**. Ratios of unpaired medians differ materially; all raw rounds remain. This noisy local diagnostic neither proves zero overhead nor broad performance improvement. In particular, frozen-array attribute lookup is more expensive.

## Held-out MDN examples

`holdout-protocol.json` selected twelve Object API pages at MDN content revision `615796ca0d6cbba67cc6576e8adf343700f8ab49` before any page contents were fetched. Production and the extractor/wrapper/native runner/scorer were hashed in `holdout-freeze.json` before download. All **58 JavaScript fences** were retained verbatim, including syntax fragments, context-dependent programs, intentional errors, and unsupported accessors. No production source was tuned after opening this holdout.

The same wrapper records JSON snapshots at console.log/info/warn/error call time and caught exception names. It tags undefined, functions, nonfinite numbers and symbols, normalizing the two standard well-known symbol identities rather than engine-internal symbol labels. JSON projection limitations, including signed zero and symbol-keyed properties, are explicit. Six pre-corpus controls matched both baseline and candidate. Initial self-test input accidentally used unsupported `Symbol()`; a supported well-known symbol then exposed the naming difference. Both adjustments happened before corpus download. The first baseline launch used a relative checkout path rejected by `createRequire`; its error is retained, and the unchanged scorer succeeded with an absolute path.

Native Node parses all 58 wrappers. The pre-frozen primary denominator requires at least one observed console output and no uncaught ReferenceError: **23 examples**. Empty/context-dependent examples cannot inflate primary successes.

| Actual implementation | Exact primary observations / 23 | Other exact observations / 35 |
| --- | ---: | ---: |
| Latest baseline | 5 | 24 |
| Frozen candidate | 13 | 31 |

There are **eight primary gains and zero primary losses**. All ten remaining primary failures are retained, including accessor examples, a constructor/prototype example, and Error-object serialization. Matching an unobserved example or a missing-context exception is not a demonstrated usage improvement. This is an externally authored instructional corpus, **not** real agent tasks or a representative estimate of all JavaScript programs.

Fixture SHA-256: `6a026f741052edfcfd02cc17916dbe13598c946aa795b6e6079a3ce3012cd5f9`; wrapper SHA-256: `2dde2736f61bef6d53454dfdc1a912e90cf59f180a0588286d8973a6f9889b60`. `holdout-sources.json` records the pinned URL and complete-page hash for every source; `holdout-fixtures.json` records every fence and source line. MDN source/license attribution must accompany any public reproduction package.

## Freshness and remaining work

After these runs, upstream refreshed to `3108505b2fdd159ed3fb0ce78b6d340776391c35`. Its two commits since the measured baseline change app upsell presentation and console/model documentation; **no CodeMode source, root package manifest or lockfile changes**. Measurements remain explicitly pinned to `9c8e9e4bca433339e06aba8caf4c57b38f636ec9`, not relabeled as a full-suite run on the new revision. Publication is only to `yuvrajvirk/opencode`.

The completed `reproduce.ts` run freshly fetched all actual commits from GitHub, independently installed four frozen dependency trees, fetched the pinned official source, regenerated fixtures, applied the exact frozen candidate patch and checked its source hashes, and re-downloaded the MDN pages. It reproduced **256→437/2,862 historical**, **480→1,895/2,862 current**, **1,416 gains / one retained loss**, **2,862/2,862 native**, and **5→13/23 held-out** exactly. `clean-reproduction/SUMMARY.json` and the per-stage logs/results preserve the fresh run. Final candidate patch SHA-256: `9118d9cc96882a213f6b7dec1905e927054c78f6452124a69fe810c9c55a3510`.

## Reproduction

- `bun prepare.ts` selects verbatim sources from the pinned local Test262 checkout and writes `manifest.json` with all exclusions.
- The three `checkouts/*` contain the actual commits; only the identical test-runner helper-loading extension differs from tracked source.
- `bun score.ts before`, `bun score.ts original`, `bun score.ts latest` run actual interpreter implementations and verify every fixture hash.
- `node native.mjs` runs the native correctness control; `node compare.mjs` verifies matched fixture/runner hashes and reports gains/losses.
- Raw results: `before.json`, `original.json`, `latest.json`, `native.json`, `comparison.json`; complete environment/install/first-attempt setup logs are retained.

The initial three interpreter launches failed before executing tests because the untracked fixture destination directories did not exist. Their error logs remain as `*-setup-failure.log`; after creating those directories, all three measured runs completed normally. No timeout/retry/pass filtering is hidden.
