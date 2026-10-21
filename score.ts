import path from "node:path"
import { createHash } from "node:crypto"

const [name, location] = process.argv.slice(2)
if (!name) throw new Error("Usage: bun score.ts before|original|latest")
const checkout = location ?? path.join(import.meta.dir, "checkouts", name)
const manifest = await Bun.file(path.join(import.meta.dir, "manifest.json")).json()
const alternative = path.join(checkout, "packages/codemode/test/property-benchmark")
const root = await Bun.file(path.join(alternative, "run.ts")).exists() ? alternative : path.join(checkout, "packages/codemode/test/test262")
const { run } = await import(path.join(root, "run.ts"))
const hash = createHash("sha256")
const results = []
for (const record of manifest.records.filter((entry) => !entry.excluded)) {
  const bytes = await Bun.file(path.join(root, record.file)).arrayBuffer()
  if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== record.sha256) throw new Error(`Changed fixture ${record.file}`)
  hash.update(record.file).update(new Uint8Array(bytes))
  results.push({ file: record.file, negative: record.negative, ...(await run(record.file)) })
}
const digest = hash.digest("hex")
if (digest !== manifest.fixture_sha256) throw new Error("Aggregate fixture mismatch")
const groups = [...new Set(results.map((record) => record.file.split("/")[2]))].map((group) => {
  const subset = results.filter((record) => record.file.split("/")[2] === group)
  return { group, pass: subset.filter((record) => record.status === "pass").length, total: subset.length }
})
const summary = {
  name, revision: (await Bun.$`git -C ${checkout} rev-parse HEAD`.text()).trim(),
  fixture_sha256: digest,
  runner_sha256: createHash("sha256").update(await Bun.file(path.join(root, "run.ts")).text()).digest("hex"),
  lock_sha256: createHash("sha256").update(await Bun.file(path.join(checkout, "bun.lock")).text()).digest("hex"),
  source_files: Object.fromEntries(await Promise.all(["src/stdlib/object.ts", "src/stdlib/property.ts", "src/stdlib/array.ts", "src/interpreter/objects.ts"].map(async (file) => {
    const source = Bun.file(path.join(checkout, "packages/codemode", file))
    return [file, await source.exists() ? createHash("sha256").update(await source.text()).digest("hex") : null]
  }))),
  pass: results.filter((record) => record.status === "pass").length, total: results.length, groups,
}
await Bun.write(path.join(import.meta.dir, `${name}.json`), JSON.stringify({ ...summary, results }, null, 2) + "\n")
console.log(JSON.stringify(summary))
