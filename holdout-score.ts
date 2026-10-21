import path from "node:path"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { wrap } from "./holdout-wrapper.mjs"

const [checkout, label] = process.argv.slice(2)
if (!checkout || !label) throw new Error("Usage: bun holdout-score.ts checkout label")
const require = createRequire(path.join(checkout, "packages/codemode/package.json"))
const { Effect } = await import(require.resolve("effect"))
const { CodeMode } = await import(path.join(checkout, "packages/codemode/src/index.ts"))
const fixtureBytes = await Bun.file(path.join(import.meta.dir, "holdout-fixtures.json")).text()
const fixtures = JSON.parse(fixtureBytes)
const oracle = await Bun.file(path.join(import.meta.dir, "holdout-native.json")).json()
const wrapperHash = createHash("sha256").update(await Bun.file(path.join(import.meta.dir, "holdout-wrapper.mjs")).text()).digest("hex")
if (createHash("sha256").update(fixtureBytes).digest("hex") !== oracle.fixture_sha256 || wrapperHash !== oracle.wrapper_sha256) throw new Error("Oracle fixture/wrapper mismatch")
const results = []
for (const fixture of fixtures) {
  const expected = oracle.results.find((result) => result.id === fixture.id)
  const result = await Effect.runPromise(CodeMode.execute({ code: wrap(fixture.code), tools: {} }))
  const observation = result.ok && typeof result.value === "string" ? JSON.parse(result.value) : undefined
  results.push({ id: fixture.id, primary: expected.primary, expected: expected.observation ?? expected.error, observation, error: result.ok ? undefined : result.error, correct: observation !== undefined && JSON.stringify(observation) === JSON.stringify(expected.observation) })
}
const summary = {
  label, runtime: `Bun ${Bun.version}`,
  fixture_sha256: oracle.fixture_sha256, wrapper_sha256: wrapperHash,
  source_files: Object.fromEntries(await Promise.all(["src/stdlib/object.ts", "src/stdlib/property.ts", "src/stdlib/array.ts", "src/interpreter/objects.ts"].map(async (file) => {
    const source = Bun.file(path.join(checkout, "packages/codemode", file))
    return [file, await source.exists() ? createHash("sha256").update(await source.text()).digest("hex") : null]
  }))),
  total: results.length,
  primary: results.filter((result) => result.primary).length,
  primary_correct: results.filter((result) => result.primary && result.correct).length,
  other_correct: results.filter((result) => !result.primary && result.correct).length,
}
await Bun.write(path.join(import.meta.dir, `holdout-${label}.json`), JSON.stringify({ ...summary, results }, null, 2) + "\n")
console.log(JSON.stringify(summary))
