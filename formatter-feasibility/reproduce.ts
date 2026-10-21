import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dir, "clean-reproduction"))
await fs.mkdir(root)
const evidence = path.join(root, "formatter-feasibility")
const sources = path.join(root, "context-wave3")
await fs.mkdir(evidence)
await fs.mkdir(path.join(sources, "archives"), { recursive: true })
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const frozen = await Bun.file(path.join(import.meta.dir, "selected-freeze.json")).json()
const run = async (name: string, args: string[], cwd = evidence) => {
  console.log(name)
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
  const [status, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  await Bun.write(path.join(evidence, `${name}.log`), stdout + stderr)
  if (status !== 0) throw new Error(`${name}: exit ${status}; inspect its retained log`)
}
const files = [
  "protocol.md", "benchmark-contract.md", "selection.md", "freeze.mjs", "selected-freeze.json",
  "survey.py", "prepare.py", "worker.ts", "score.mjs", "requirements.txt", "candidate.patch",
  "regex-audit.py", "regex-audit.ts", "regex-audit-fixtures.json",
]
for (const name of files) {
  const bytes = await fs.readFile(path.join(import.meta.dir, name))
  if (frozen.research[name]) assert.equal(hash(bytes), frozen.research[name], name)
  await fs.writeFile(path.join(evidence, name), bytes)
}
for (const name of ["grep-corpus.json", "snapshot-manifest.json"]) {
  const bytes = await fs.readFile(path.join(import.meta.dir, "../context-wave3", name))
  assert.equal(hash(bytes), frozen.research[`../context-wave3/${name}`], name)
  await fs.writeFile(path.join(sources, name), bytes)
}
const manifest = await Bun.file(path.join(sources, "snapshot-manifest.json")).json()
for (let offset = 0; offset < manifest.length; offset += 4) {
  await Promise.all(manifest.slice(offset, offset + 4).map(async (record) => {
    const response = await fetch(record.url)
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}: ${record.url}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.equal(hash(bytes), record.sha256, record.url)
    await fs.writeFile(path.join(sources, "archives", `${record.revision}.tar.gz`), bytes)
  }))
}
console.log(`Downloaded and verified ${manifest.length} complete source archives; licenses remain inside`)
await run("python-setup", ["uv", "venv", "--python", "3.13.14", ".venv"])
const python = path.join(evidence, ".venv/bin/python")
await run("python-install", ["uv", "pip", "install", "--python", python, "-r", "requirements.txt"])
for (const split of ["development", "heldout"]) {
  await run(`${split}-survey`, [python, "survey.py", "--split", split])
  await run(`${split}-prepare`, [python, "prepare.py", "--split", split, "--output", `${split}-fixtures.json`, "--summary", `${split}-fixture-summary.json`])
  const expected = split === "development"
    ? frozen.research["development-fixtures-v3.json"]
    : "56148bed6a20fdc65336daf64a436b84dc87356dc784ab2774137c2f2413b717"
  assert.equal(hash(await fs.readFile(path.join(evidence, `${split}-fixtures.json`))), expected, `${split} fixtures`)
}
await run("source-init", ["git", "init", "source"])
const repository = path.join(evidence, "source")
await run("source-remote", ["git", "remote", "add", "origin", "https://github.com/yuvrajvirk/opencode.git"], repository)
const revisions = {
  before: "b848b7ebae7b783ae5dc121f1c865f17da453543",
  original: "9d0f88e60463cc1de5b1e5e586b9f8fcdf98ac4c",
  latest: frozen.base,
}
for (const [name, revision] of Object.entries(revisions)) {
  await run(`${name}-fetch`, ["git", "fetch", "--depth", "1", "origin", revision], repository)
  await run(`${name}-checkout`, ["git", "worktree", "add", "--detach", path.join(evidence, "checkouts", name), revision], repository)
}
const candidate = path.join(evidence, "checkouts/candidate")
await run("candidate-checkout", ["git", "worktree", "add", "--detach", candidate, frozen.base], repository)
await run("candidate-apply", ["git", "apply", path.join(evidence, "candidate.patch")], candidate)
for (const [name, expected] of Object.entries(frozen.production)) {
  assert.equal(hash(await fs.readFile(path.join(candidate, name))), expected, name)
}
for (const name of ["before", "original", "latest", "candidate"]) {
  const checkout = path.join(evidence, "checkouts", name)
  await run(`${name}-install`, ["bun", "install", "--frozen-lockfile", "--ignore-scripts"], checkout)
  await run(name, ["bun", "worker.ts", checkout, "all", "development-fixtures.json"])
}
await run("development-score", ["node", "score.mjs", "--fixture", "development-fixtures.json", "--output", "development-score.json", "before", "original", "latest", "candidate"])
for (const name of ["latest", "candidate"]) {
  await run(`heldout-${name}`, ["bun", "worker.ts", path.join(evidence, "checkouts", name), "all", "heldout-fixtures.json"])
}
await run("heldout-score", ["node", "score.mjs", "--fixture", "heldout-fixtures.json", "--output", "heldout-score.json", "heldout-latest", "heldout-candidate"])
const summary = {
  source: "Fresh remote archives and shallow commits; four independently installed locked checkouts; regenerated identical fixtures and frozen production hashes",
  development: await Bun.file(path.join(evidence, "development-score.json")).json(),
  heldout: await Bun.file(path.join(evidence, "heldout-score.json")).json(),
}
await Bun.write(path.join(evidence, "SUMMARY.json"), JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify({
  development: summary.development.versions.map(({ name, correct, total }) => ({ name, correct, total })),
  heldout: summary.heldout.versions.map(({ name, correct, total }) => ({ name, correct, total })),
}, null, 2))
