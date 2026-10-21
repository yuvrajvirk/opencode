import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dir, "clean-reproduction"))
await fs.mkdir(root)
const protocol = await Bun.file(path.join(import.meta.dir, "protocol.json")).json()
const frozen = await Bun.file(path.join(import.meta.dir, "holdout-freeze.json")).json()
const run = async (name: string, args: Array<string>, cwd = root) => {
  console.log(name)
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  await Bun.write(path.join(root, `${name}.log`), stdout + stderr)
  if (code !== 0) throw new Error(`${name} failed with exit ${code}; see ${root}/${name}.log`)
}
for (const name of ["protocol.json", "prepare.ts", "score.ts", "compare.mjs", "native.mjs", "holdout-protocol.json", "holdout-prepare.ts", "holdout-wrapper.mjs", "holdout-native.mjs", "holdout-score.ts", "candidate.patch", "research-run.ts"]) {
  await fs.copyFile(path.join(import.meta.dir, name), path.join(root, name))
}
await run("source-init", ["git", "init", "source"])
const source = path.join(root, "source")
await run("source-remote", ["git", "remote", "add", "origin", "https://github.com/yuvrajvirk/opencode.git"], source)
for (const name of ["before", "original", "latest"]) {
  await run(`${name}-fetch`, ["git", "fetch", "--depth", "1", "origin", protocol[name]], source)
  await run(`${name}-checkout`, ["git", "worktree", "add", "--detach", path.join(root, "checkouts", name), protocol[name]], source)
}
const candidate = path.join(root, "checkouts", "candidate")
await run("candidate-checkout", ["git", "worktree", "add", "--detach", candidate, protocol.latest], source)
await run("candidate-apply", ["git", "apply", path.join(root, "candidate.patch")], candidate)
for (const [file, expected] of Object.entries(frozen.hashes)) {
  if (!file.startsWith("packages/")) continue
  assert.equal(createHash("sha256").update(await fs.readFile(path.join(candidate, file))).digest("hex"), expected, file)
}
await run("test262-init", ["git", "init", "test262"])
const test262 = path.join(root, "test262")
await run("test262-remote", ["git", "remote", "add", "origin", "https://github.com/tc39/test262.git"], test262)
await run("test262-fetch", ["git", "fetch", "--depth", "1", "origin", protocol.source_revision], test262)
await run("test262-checkout", ["git", "checkout", "--detach", protocol.source_revision], test262)
await run("prepare", ["bun", "prepare.ts", test262, path.join(root, "checkouts/latest")])
const manifest = await Bun.file(path.join(root, "manifest.json")).json()
assert.equal(manifest.fixture_sha256, "00c72d332bf5b86dcadea228265901f4148a4840f859eb9a1787915cf152d0b0")
for (const name of ["before", "original", "latest", "candidate"]) {
  const checkout = path.join(root, "checkouts", name)
  await run(`${name}-install`, ["bun", "install", "--frozen-lockfile", "--ignore-scripts"], checkout)
  const stock = await fs.readFile(path.join(checkout, "packages/codemode/test/test262/run.ts"))
  assert.equal(createHash("sha256").update(stock).digest("hex"), "28daec109e1cd254cdd54b261d4963d5488d35342ed25bc29185d26a91d087e1")
  const target = path.join(checkout, "packages/codemode/test/property-benchmark")
  await fs.cp(path.join(root, "fixtures"), target, { recursive: true })
  await fs.copyFile(path.join(root, "research-run.ts"), path.join(target, "run.ts"))
  await fs.copyFile(path.join(root, "propertyHelper.js"), path.join(target, "propertyHelper.js"))
  await fs.writeFile(path.join(target, "skipped.txt"), "")
  await run(`${name}-score`, ["bun", "score.ts", name, checkout])
}
await run("native", ["node", "native.mjs", test262])
await run("comparison", ["node", "compare.mjs", "before", "original", "latest", "candidate"])
await run("holdout-prepare", ["bun", "holdout-prepare.ts"])
await run("holdout-native", ["node", "holdout-native.mjs"])
for (const name of ["latest", "candidate"]) await run(`holdout-${name}`, ["bun", "holdout-score.ts", path.join(root, "checkouts", name), name])
const summary = {
  source: "Fresh shallow GitHub fetches of each pinned commit; four independently installed frozen dependency trees; unchanged frozen candidate patch",
  official: await Bun.file(path.join(root, "comparison.json")).json(),
  holdout: await Promise.all(["latest", "candidate"].map(async (name) => {
    const { results, ...summary } = await Bun.file(path.join(root, `holdout-${name}.json`)).json()
    return summary
  })),
}
await Bun.write(path.join(root, "SUMMARY.json"), JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify({ official: summary.official.versions.map(({ name, pass, total }) => ({ name, pass, total })), holdout: summary.holdout.map(({ label, primary, primary_correct }) => ({ label, primary, primary_correct })) }))
