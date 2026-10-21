# Ten-change integration on refreshed upstream

All ten fork contributions (#2–#11) apply together without conflicts on upstream `d10692ecb0aa827152b5c65ef76781869e758092`. No production contribution branch was modified. This is compatibility evidence, not a replacement for each contribution's independent historical/current/held-out benchmarks.

The nine-change published integration patch is applied first, followed by the exact eight-file diff of formatter commit `76401aa6543a85a7ddf366ac869a00d7a31fbf5e` (including documentation). The combined staged tree is `4608c7cf6690217a11be6169ec39d4e40da67edc`. The worktree is detached at the stated upstream base; this tree ID is not an independently published commit. `combined.patch` is the reproducible input and has SHA-256 `bce6c9d3e41eca1ad22ba669e0b508ff6b6eac59baba83210116b57aa3f1958a`.

| Check | Result |
| --- | --- |
| Full CodeMode suite | 15,254 pass, 1,229 skip, zero failures; 2,782 assertions |
| Nine focused Core test files | 205 pass, zero failures; 498 assertions |
| Canonical workspace check | 34/34 successful |

Dependencies are installed with `bun install --frozen-lockfile --ignore-scripts`. Test262 fixtures are regenerated from pinned revision `250f204f23a9249ff204be2baec29600faae7b75`. The Core subset covers reading, edit alignment, ripgrep/search, composed argument repair and both formatter files. This is not a full Core suite or a Windows execution claim. No tests are removed or relaxed; no actual agent/model calls run.

## Reproduce

```sh
git clone https://github.com/yuvrajvirk/opencode.git integration-ten
cd integration-ten
git checkout --detach d10692ecb0aa827152b5c65ef76781869e758092
git apply /absolute/path/to/evidence/integration-ten/combined.patch
bun install --frozen-lockfile --ignore-scripts
bun run check
cd packages/codemode
bun run script/sync-test262.ts /absolute/path/to/pinned-test262
bun test
cd ../core
bun run script/test.ts test/tool-read.test.ts test/tool-read-filesystem.test.ts test/tool-edit.test.ts test/ripgrep.test.ts test/plugin/tool-input-repair.test.ts test/plugin/tool-input-repair-integration.test.ts test/tool-search.test.ts test/formatter-black.test.ts test/formatter.test.ts
```
