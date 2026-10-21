import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"

const root = new URL(".", import.meta.url).pathname
const [beforeName, afterName, outputName] = process.argv.slice(2)
assert(beforeName && afterName && outputName, "Usage: node compare.mjs before after output.json")
const before = JSON.parse(fs.readFileSync(path.join(root, `${beforeName}.log`)))
const after = JSON.parse(fs.readFileSync(path.join(root, `${afterName}.log`)))
assert.equal(before.fixture_sha256, after.fixture_sha256)
assert.equal(before.protocol_sha256, after.protocol_sha256)
assert.deepEqual(before.profiles, after.profiles)
const identity = (item) => `${item.id}/${item.profile}`
const old = new Map(before.results.map((item) => [identity(item), item]))
assert.equal(old.size, before.results.length)
assert.equal(new Set(after.results.map(identity)).size, after.results.length)
assert.deepEqual(new Set(after.results.map(identity)), new Set(old.keys()))
const pairs = after.results.map((item) => ({ before: old.get(identity(item)), after: item }))
for (const pair of pairs) {
  for (let index = 0; index < Math.min(pair.before.stages.length, pair.after.stages.length); index++)
    assert.equal(pair.before.stages[index].expected_sha256, pair.after.stages[index].expected_sha256)
}
const identified = (item) => ({ id: item.id, repo: item.repo, path: item.path, band: item.band, profile: item.profile })
const matched = pairs.filter((pair) => !pair.before.error && !pair.after.error)
const cost = (item, phase) => item.stages.filter((stage) => stage.phase === phase)
  .reduce((sum, stage) => sum + stage.document_bytes + stage.blob_bytes, 0)
const summarize = (selected, phase) => {
  const cases = selected.map((pair) => ({
    ...identified(pair.after), before: cost(pair.before, phase), after: cost(pair.after, phase),
  }))
  return {
    matched_scenarios: cases.length,
    wins: cases.filter((item) => item.after < item.before).length,
    losses: cases.filter((item) => item.after > item.before).length,
    ties: cases.filter((item) => item.after === item.before).length,
    before_bytes: cases.reduce((sum, item) => sum + item.before, 0),
    after_bytes: cases.reduce((sum, item) => sum + item.after, 0),
    unfavorable: cases.filter((item) => item.after > item.before)
      .sort((left, right) => (right.after - right.before) - (left.after - left.before)),
  }
}
const report = {
  before: beforeName, after: afterName, fixture_sha256: before.fixture_sha256,
  caveat: "Efficiency comparisons use jointly exact scenarios only; all newly correct, newly incorrect, and jointly failing cases are listed separately. Group reports exclude failures and are not a claim that the entire band is exact.",
  newly_correct: pairs.filter((pair) => pair.before.error && !pair.after.error).map((pair) => identified(pair.after)),
  newly_incorrect: pairs.filter((pair) => !pair.before.error && pair.after.error).map((pair) => identified(pair.after)),
  jointly_failing: pairs.filter((pair) => pair.before.error && pair.after.error).map((pair) => identified(pair.after)),
  phases: Object.fromEntries(["initial", "edit", "undo"].map((phase) => [phase, summarize(matched, phase)])),
  groups: ["small", "medium", "large"].flatMap((band) => before.profiles.map((profile) => ({
    band, profile,
    ...summarize(matched.filter((pair) => pair.after.band === band && pair.after.profile === profile), "edit"),
  }))),
}
fs.writeFileSync(path.join(root, outputName), JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify({
  newly_correct: report.newly_correct.length, newly_incorrect: report.newly_incorrect.length,
  phases: Object.fromEntries(Object.entries(report.phases).map(([phase, { unfavorable, ...counts }]) => [phase, counts])),
}, null, 2))
