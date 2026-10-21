# Nine-change integration check

All nine fork contributions (#2–#10) combine without a cherry-pick conflict and pass the checks below. This is compatibility evidence, not a replacement for their independent historical/current benchmarks.

## Exact state

- Common baseline: `f7577a1f65b465b35b0dcb30b23f22c14e3b5460`.
- Prior eight-change local integration: `4deb72a10525f214ddfcc09e7dffad633e227358`.
- Added the exact published object-property commit: `de401da9ba6050bdffcb52a99a11fb002809b175`.
- Resulting local detached integration commit: `4a541e8cce64d847626c2500d9912b151e73a6a8`.
- No production contribution branch changed, and no combined production branch was pushed.

The object-property contribution was measured on the newer baseline `9c8e9e4bca`; this combined check deliberately uses the prior integration baseline. It must not be described as a run on the newest upstream revision.

## Results

| Check | Result |
| --- | --- |
| Full CodeMode suite | **15,254 pass, 1,229 skip, zero fail; 2,782 assertions** |
| Core read, filesystem read, edit, ripgrep and two repair files | **120 pass, zero fail; 325 assertions** |
| Core tool-search/grep | **22 pass, zero fail; 91 assertions** |
| Canonical workspace check | **34/34 successful** |

Dependencies were independently installed with `bun install --frozen-lockfile --ignore-scripts`. Official tests were synced from Test262 revision `250f204f23a9249ff204be2baec29600faae7b75`, the same pinned source used by the individual evaluations. The initial sync was launched from the repository root instead of the CodeMode package and failed before running; `prepare.log` preserves the error. The corrected package-local invocation completed successfully. No tests were removed or relaxed in this integration run.

## Reproduce

`combined.patch` applies all nine published contributions to the stated common baseline. The integration commit identifiers are local audit identifiers; the patch avoids depending on those unpublished Git objects.

```sh
git clone https://github.com/yuvrajvirk/opencode.git combined-check
cd combined-check
git checkout --detach f7577a1f65b465b35b0dcb30b23f22c14e3b5460
git apply /absolute/path/to/evidence/integration-nine/combined.patch
bun install --frozen-lockfile --ignore-scripts
bun run check
cd packages/codemode
bun run script/sync-test262.ts /absolute/path/to/pinned-test262
bun test
cd ../core
bun run script/test.ts test/tool-read.test.ts test/tool-read-filesystem.test.ts test/tool-edit.test.ts test/ripgrep.test.ts test/plugin/tool-input-repair.test.ts test/plugin/tool-input-repair-integration.test.ts test/tool-search.test.ts
```

The full CodeMode run exercises array-like callbacks, OpenAPI forms, tool ranking, text decoding and property descriptors together. The selected Core files exercise the other changes; this is **not** a claim that the entire Core suite was run.
