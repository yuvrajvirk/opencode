import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"

const root = process.argv[2]
if (!root) throw new Error("Usage: bun native-filter-controls.ts checkout")
const require = createRequire(path.join(root, "packages/core/package.json"))
const { Effect } = await import(require.resolve("effect"))
const { FSUtil } = await import(path.join(root, "packages/util/src/fs-util.ts"))
const { AppProcess } = await import(path.join(root, "packages/util/src/process.ts"))
const { LayerNode } = await import(path.join(root, "packages/util/src/effect/layer-node.ts"))
const { AppNodeBuilder } = await import(path.join(root, "packages/core/src/effect/app-node-builder.ts"))
const { BlackFormatter } = await import(path.join(root, "packages/core/src/formatter/black.ts"))
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "formatter-native-controls-"))
const bin = path.join(temporary, "bin", "black")
await fs.mkdir(path.dirname(bin))
await fs.writeFile(bin, "#!/bin/sh\nexit 93\n", { mode: 0o755 })
await fs.writeFile(path.join(temporary, "re.py"), "raise RuntimeError('project re module was executed')\n")
await fs.writeFile(path.join(temporary, "json.py"), "raise RuntimeError('project json module was executed')\n")
const missing = process.argv.includes("--missing-python")
if (missing) process.env.PATH = path.dirname(bin)
const fixtures = missing ? [
  { name: "missing Python preserves the file", pattern: ".*", target: "example.py", expected: "skip" },
] : [
  { name: "project module shadows stay unexecuted", pattern: "\\Aexample\\.py\\Z", target: "example.py", expected: "command" },
  { name: "verbose regex remains data", pattern: "(?x)^example\\.py$ # __import__('os').system('exit 93')", target: "example.py", expected: "command" },
  { name: "invalid native regex fails closed", pattern: "[", target: "example.py", expected: "skip" },
  { name: "pathological regex is bounded", pattern: "^(a+)+$", target: "a".repeat(120) + "!.py", expected: "skip" },
]
const results = []
try {
  await Effect.runPromise(Effect.gen(function* () {
    const filesystem = yield* FSUtil.Service
    const processes = yield* AppProcess.Service
    for (const fixture of fixtures) {
      yield* Effect.promise(() => fs.writeFile(path.join(temporary, ".pre-commit-config.yaml"), JSON.stringify({ repos: [{ repo: "https://github.com/psf/black", hooks: [{ id: "black", files: fixture.pattern }] }] })))
      const started = performance.now()
      const command = yield* BlackFormatter.command({ filepath: path.join(temporary, fixture.target), directory: temporary, worktree: temporary, fs: filesystem, processes, bin })
      const actual = Array.isArray(command) ? "command" : command
      results.push({ ...fixture, actual, correct: actual === fixture.expected, elapsed_ms: performance.now() - started })
    }
  }).pipe(Effect.provide(AppNodeBuilder.build(LayerNode.group([FSUtil.node, AppProcess.node])))))
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
const result = {
  scope: "Post-prototype process and failure-boundary controls, not held-out quality evidence",
  source_sha256: createHash("sha256").update(await fs.readFile(path.join(root, "packages/core/src/formatter/black.ts"))).digest("hex"),
  correct: results.filter((entry) => entry.correct).length,
  total: results.length,
  results,
}
await Bun.write(path.join(import.meta.dir, missing ? "native-filter-missing-python.json" : "native-filter-controls.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))
