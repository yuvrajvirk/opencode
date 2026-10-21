import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const root = process.argv[2]
if (!root) throw new Error("Usage: bun regex-audit.ts checkout")
const evidence = new URL(".", import.meta.url).pathname
const require = createRequire(path.join(root, "packages/core/package.json"))
const { Effect } = await import(require.resolve("effect"))
const { FSUtil } = await import(path.join(root, "packages/util/src/fs-util.ts"))
const { AppProcess } = await import(path.join(root, "packages/util/src/process.ts"))
const { LayerNode } = await import(path.join(root, "packages/util/src/effect/layer-node.ts"))
const { AppNodeBuilder } = await import(path.join(root, "packages/core/src/effect/app-node-builder.ts"))
const { BlackFormatter } = await import(path.join(root, "packages/core/src/formatter/black.ts"))
const fixtureBytes = await fs.readFile(path.join(evidence, "regex-audit-fixtures.json"))
const fixture = JSON.parse(fixtureBytes.toString())
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-filter-audit-"))
const results = []
try {
  await Effect.runPromise(
    Effect.gen(function* () {
      const filesystem = yield* FSUtil.Service
      const processes = yield* AppProcess.Service
      for (const record of fixture.patterns) {
        for (const field of ["files", "exclude"]) {
          yield* Effect.promise(() => fs.writeFile(path.join(temporary, ".pre-commit-config.yaml"), JSON.stringify({
            repos: [{ repo: "https://github.com/psf/black", hooks: [{ id: "black", [field]: record.pattern }] }],
          })))
          for (const entry of record.cases) {
            const actual = yield* BlackFormatter.command({
              filepath: path.join(temporary, entry.path), directory: temporary, worktree: temporary,
              fs: filesystem, processes, bin: "black",
            })
            const expected = field === "files" ? entry.matches : !entry.matches
            results.push({
              pattern: record.pattern, field, path: entry.path, expected,
              actual: actual === false ? "unsupported" : actual === "skip" ? false : true,
            })
          }
        }
      }
    }).pipe(Effect.provide(AppNodeBuilder.build(LayerNode.group([FSUtil.node, AppProcess.node])))),
  )
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
const unsupported = results.filter((entry) => entry.actual === "unsupported")
const incorrect = results.filter((entry) => entry.actual !== "unsupported" && entry.actual !== entry.expected)
console.log(JSON.stringify({
  fixture_sha256: createHash("sha256").update(fixtureBytes).digest("hex"),
  source_sha256: createHash("sha256").update(await fs.readFile(path.join(root, "packages/core/src/formatter/black.ts"))).digest("hex"),
  cases: results.length, correct: results.length - unsupported.length - incorrect.length,
  unsupported: unsupported.length, incorrect: incorrect.length, wrong: incorrect, results,
}))
