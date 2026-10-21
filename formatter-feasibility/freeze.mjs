import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"

const root = new URL(".", import.meta.url).pathname
const checkout = "/home/yvirk2/opencode-worktrees/black-formatter"
const hash = (filename) => createHash("sha256").update(fs.readFileSync(filename)).digest("hex")
const production = [
  "packages/core/src/formatter/black.ts",
  "packages/core/src/formatter/builtins.ts",
  "packages/core/src/formatter.ts",
  "packages/core/test/formatter-black.test.ts",
  "packages/core/test/formatter.test.ts",
  "packages/core/package.json",
  "bun.lock",
]
const research = [
  "protocol.md", "benchmark-contract.md", "selection.md", "freeze.mjs",
  "survey.py", "prepare.py", "worker.ts", "score.mjs", "requirements.txt",
  "development-fixtures-v3.json", "regex-audit-fixtures.json",
  "../context-wave3/grep-corpus.json", "../context-wave3/snapshot-manifest.json",
]
for (const filename of ["heldout-configs.json", "heldout-fixtures.json", "heldout-latest.log", "heldout-candidate.log"]) {
  if (fs.existsSync(path.join(root, filename))) throw new Error(`Holdout already accessed: ${filename}`)
}
const frozen = {
  created_at: new Date().toISOString(),
  base: execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim(),
  rule: "No production or scorer tuning after held-out access; retain all cases and failures.",
  production: Object.fromEntries(production.map((filename) => [filename, hash(path.join(checkout, filename))])),
  research: Object.fromEntries(research.map((filename) => [filename, hash(path.join(root, filename))])),
}
fs.writeFileSync(path.join(root, "selected-freeze.json"), JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify(frozen, null, 2))
