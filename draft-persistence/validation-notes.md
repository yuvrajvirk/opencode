# Development validation notes

The candidate adds three owning-module tests: middle-edit storage reuse, large active-draft cache reuse over repeated edits, and exact U+FEFF restoration across boundaries. Existing tests own storage failure/retry, collection recovery, stale writes, image lifetime, and missing-data semantics; do not duplicate these elsewhere.

The first 72-test persistence run passed (259 assertions). A baseline-negative run caught two storage regressions but the initial Unicode test falsely passed: Happy DOM replaces Blob and its text decoder differs from native Blob.text(). Merely omitting the CLI preload does not remove packages/app/bunfig.toml's configured preload. Both unsuccessful negative-proof attempts are retained.

The Unicode case now obtains a real node:buffer Blob from the driver's persisted bytes, through the existing public getBlob boundary. It does not replace globals, mock modules, change expected text, or add a production test seam. With this driver, all three new tests fail on the pristine latest baseline (0 pass, 3 fail), while the candidate's entire 19-test draft file passes ten repetitions (190 pass, 610 assertions). Baseline temporary test was removed afterward; checkout is clean. This distinction matters because Happy DOM success alone would not demonstrate the boundary regression.

The sixth prototype, pressure-aware cache hits, restores all development and diagnostic cases exactly. Compared with weighted LRU it submits 807,732 additional development edit bytes (two large middle/delete scenarios) and 4,718,592 additional diagnostic bytes (four no-newline middle/delete scenarios). These regressions remain in the raw logs; the experiment is not yet selected. Its same-protocol cross-engine paired cost campaign is running. Production source must not change while that campaign is live.

No draft holdout fixtures have been prepared. Scorer CLI paths were generalized before freeze without changing fixture selection, expected values, or score definitions. The separate cost scorer accepts the named prototype and still asserts every observation against that prototype's original actual-runtime run.
