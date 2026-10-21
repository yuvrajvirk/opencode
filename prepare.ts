import path from "node:path"
import fs from "node:fs/promises"
import { createHash } from "node:crypto"

const root = import.meta.dir
const protocol = await Bun.file(path.join(root, "protocol.json")).json()
const checkout = process.argv[2] ?? "/home/yvirk2/opencode-research/test262"
const baseline = process.argv[3] ?? "/home/yvirk2/opencode"
const revision = (await Bun.$`git -C ${checkout} rev-parse HEAD`.text()).trim()
if (revision !== protocol.source_revision) throw new Error("Unexpected Test262 revision")
const manifest = await Bun.file(path.join(baseline, "packages/codemode/test/test262/manifest.json")).json()
const boundaries = Object.entries(manifest.boundaries)
  .filter(([name]) => name !== "property descriptors")
  .map(([name, pattern]) => [name, new RegExp(String(pattern))] as const)
const allowedHarness = [...manifest.harness, "propertyHelper.js"]
const records = []
const aggregate = createHash("sha256")
for (const directory of protocol.directories) {
  for (const name of [...new Bun.Glob("**/*.js").scanSync({ cwd: path.join(checkout, "test", directory) })].sort()) {
    const file = path.posix.join(directory, name)
    const bytes = await fs.readFile(path.join(checkout, "test", file))
    const text = bytes.toString()
    const start = text.indexOf("/*---")
    const end = text.indexOf("---*/", start)
    const metadata = start === -1 ? {} : Bun.YAML.parse(text.slice(start + 5, end))
    const code = start === -1 ? text : text.slice(end + 5)
    const reason = name.endsWith("_FIXTURE.js") ? "fixture" :
      metadata.flags?.find((flag) => manifest.flags.includes(flag)) ??
      metadata.features?.find((feature) => manifest.features.includes(feature)) ??
      metadata.includes?.find((include) => !allowedHarness.includes(include)) ??
      boundaries.find(([, pattern]) => pattern.test(code))?.[0]
    const sha256 = createHash("sha256").update(bytes).digest("hex")
    records.push({ file, sha256, negative: metadata.negative !== undefined, excluded: reason ?? null, includes: metadata.includes ?? [] })
    if (reason !== undefined) continue
    aggregate.update(file).update(bytes)
    await fs.mkdir(path.dirname(path.join(root, "fixtures", file)), { recursive: true })
    await fs.writeFile(path.join(root, "fixtures", file), bytes)
  }
}
await fs.copyFile(path.join(checkout, "harness/propertyHelper.js"), path.join(root, "propertyHelper.js"))
const selected = records.filter((record) => !record.excluded)
const exclusions = Object.fromEntries([...new Set(records.flatMap((record) => record.excluded ? [record.excluded] : []))].map((reason) => [reason, records.filter((record) => record.excluded === reason).length]))
const result = {
  fixture_sha256: aggregate.digest("hex"), source_revision: revision,
  total: records.length, selected: selected.length,
  positive: selected.filter((record) => !record.negative).length,
  negative: selected.filter((record) => record.negative).length,
  exclusions, records,
}
await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ ...result, records: undefined }))
