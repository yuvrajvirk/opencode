import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { parseArgs } from "node:util"

const root = new URL(".", import.meta.url).pathname
const { values, positionals: names } = parseArgs({
  allowPositionals: true,
  options: {
    fixture: { type: "string", default: "development-fixtures.json" },
    output: { type: "string", default: "development-score.json" },
  },
})
const fixtureBytes = fs.readFileSync(path.join(root, values.fixture))
const fixture = JSON.parse(fixtureBytes)
const fixtureHash = createHash("sha256").update(fixtureBytes).digest("hex")
const profiles = ["append", "prepend", "middle", "delete", "replace"]
const files = fixture.snapshots.flatMap((snapshot) => snapshot.files)
const identities = new Set(files.flatMap((file) => profiles.map((profile) => `${file.id}/${profile}`)))
const inputs = (names.length ? names : ["before", "original", "latest"]).map((name) => {
  const record = JSON.parse(fs.readFileSync(path.join(root, `${name}.log`), "utf8"))
  assert.equal(record.fixture_sha256, fixtureHash, name)
  assert.equal(record.protocol_sha256, fixture.protocol_sha256, name)
  assert.deepEqual(record.profiles, profiles, name)
  const observed = new Set(record.results.map((item) => `${item.id}/${item.profile}`))
  assert.equal(observed.size, record.results.length, `Duplicate observations: ${name}`)
  assert.deepEqual(observed, identities, `Missing/extra cases: ${name}`)
  for (const result of record.results) {
    if (result.error) continue
    assert.equal(result.stages.length, 12, `${name}/${result.id}/${result.profile}`)
    assert.deepEqual(result.stages.map((stage) => stage.phase), ["initial", ...Array(10).fill("edit"), "undo"])
    assert(result.stages.every((stage) => stage.exact))
    assert.equal(result.stages[0].expected_sha256, result.stages.at(-1).expected_sha256, "Undo must restore original")
  }
  return { name, record }
})
for (const { name, record } of inputs.slice(1)) {
  assert.equal(record.worker_sha256, inputs[0].record.worker_sha256, name)
  const reference = new Map(inputs[0].record.results.map((item) => [`${item.id}/${item.profile}`, item]))
  for (const item of record.results) {
    const previous = reference.get(`${item.id}/${item.profile}`)
    for (let index = 0; index < Math.min(previous.stages.length, item.stages.length); index++) {
      assert.equal(item.stages[index].expected_sha256, previous.stages[index].expected_sha256, "Changed expected document")
    }
  }
}
const versions = inputs.map(({ name, record }) => {
  const errors = record.results.filter((item) => item.error).map(({ id, repo, path, profile, error }) => ({ id, repo, path, profile, error }))
  const groups = []
  for (const band of ["small", "medium", "large"]) {
    for (const profile of profiles) {
      const selected = record.results.filter((item) => item.band === band && item.profile === profile)
      const failed = selected.filter((item) => item.error).length
      const phases = Object.fromEntries(["initial", "edit", "undo"].map((phase) => {
        const stages = selected.flatMap((item) => item.stages.filter((stage) => stage.phase === phase))
        const sums = Object.fromEntries(["document_bytes", "blob_bytes", "document_calls", "blob_calls", "elapsed_ms"].map((key) => [key, stages.reduce((total, stage) => total + stage[key], 0)]))
        return [phase, { ...sums, total_bytes: sums.document_bytes + sums.blob_bytes, exact_observations: stages.filter((stage) => stage.exact).length }]
      }))
      groups.push({
        band, profile, cases: selected.length, failed, valid_efficiency_comparison: failed === 0,
        phases,
        retained_unique_blob_bytes: failed ? null : selected.reduce((total, item) => total + item.retained_unique_blob_bytes, 0),
        retained_document_bytes: failed ? null : selected.reduce((total, item) => total + item.retained_document_bytes, 0),
      })
    }
  }
  return {
    name, revision: record.revision, source_sha256: record.source_sha256, lock_sha256: record.lock_sha256,
    scenarios: record.results.length, exact_saves: record.results.reduce((total, item) => total + item.stages.filter((stage) => stage.exact).length, 0),
    errors, groups,
  }
})
const summary = {
  fixture_sha256: fixtureHash, files: files.length, profiles,
  caveat: "Single-run elapsed times are exploratory, not a latency claim. Retention is before collection in the instrumented in-memory sink, not disk size after GC.",
  versions,
}
fs.writeFileSync(path.join(root, values.output), JSON.stringify(summary, null, 2) + "\n")
for (const version of versions) {
  console.log(`${version.name}: ${version.exact_saves} exact saves; ${version.errors.length} errors`)
  for (const group of version.groups) console.log(`${group.band}/${group.profile}: ${group.phases.edit.total_bytes} edit bytes, ${group.failed} failed cases`)
}
