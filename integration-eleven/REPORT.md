# Eleven-change compatibility on refreshed upstream

All eleven fork contributions (#2–#12) apply together without conflicts on upstream `863ea413649484b5761cd0c5c0e54c559a5c8b52`. No individual production branch changes. This is integration evidence, not a substitute for each contribution's independent historical/current/heldout benchmark.

Apply the exact published ten-change combined patch, then the three-file diff of draft candidate `cc841a7e47ede3b602d20d82029c8e8cb201bc99`. The staged combined tree is `44919aab727491ef7dcc2887f84424508f24ec90`, not a separately published production commit. Reproducible `combined.patch` SHA-256: `f9fda277d6b54b16c872bf8c218229c4f9884dc37f2015f0d1c2d75a1b5d1dea`.

| Check | Result |
| --- | --- |
| Full CodeMode suite | 15,254 pass, 1,229 skip, zero failures; 2,782 assertions |
| Nine focused Core files | 205 pass, zero failures; 498 assertions |
| Full app units | 766 pass, zero failures; 2,279 assertions |
| Full app browser-condition suite | 173 pass, zero failures; 1,804 assertions |
| Canonical workspace check | 34/34 successful |

Bun 1.4.2; dependencies installed with `--frozen-lockfile --ignore-scripts`. Test262 regenerated from pinned revision `250f204f23a9249ff204be2baec29600faae7b75`. Browser-condition tests use Happy DOM, not an actual Chromium E2E run. This is not the full Core suite or Windows execution. No actual agent/model test runs. Expected negative-fixture error output remains in the logs; test process exits are zero.

## Reproduce

```sh
git clone https://github.com/yuvrajvirk/opencode.git integration-eleven
cd integration-eleven
git checkout --detach 863ea413649484b5761cd0c5c0e54c559a5c8b52
git apply /absolute/path/to/evidence/integration-eleven/combined.patch
bun install --frozen-lockfile --ignore-scripts
bun run check
cd packages/codemode
bun run script/sync-test262.ts /absolute/path/to/pinned-test262
bun test
cd ../core
bun run script/test.ts test/tool-read.test.ts test/tool-read-filesystem.test.ts test/tool-edit.test.ts test/ripgrep.test.ts test/plugin/tool-input-repair.test.ts test/plugin/tool-input-repair-integration.test.ts test/tool-search.test.ts test/formatter-black.test.ts test/formatter.test.ts
cd ../app
bun run test
```
