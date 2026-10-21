import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = new URL(".", import.meta.url).pathname
const inputs = process.argv.slice(2)
const option = (name, fallback) => {
  const position = inputs.indexOf(name)
  if (position === -1) return fallback
  if (!inputs[position + 1]) throw new Error(`Missing value for ${name}`)
  return inputs.splice(position, 2)[1]
}
const fixturePath = option("--fixture", "development-fixtures.json")
const outputPath = option("--output", "development-score.json")
const baselineName = option("--baseline", undefined)
const beforeName = option("--before", "before")
const originalName = option("--original", "original")
const fixtureText = fs.readFileSync(path.join(root, fixturePath), "utf8")
const fixture = JSON.parse(fixtureText)
const fixtureHash = createHash("sha256").update(fixtureText).digest("hex")
const cases = fixture.snapshots.flatMap((snapshot) => snapshot.files.map((file) => ({ ...file, repo: snapshot.repo, tool: snapshot.declaration.tool })))
const versions = (inputs.length ? inputs : ["before", "original", "latest"]).map((name) => {
  const lines = fs.readFileSync(path.join(root, `${name}.log`), "utf8").trim().split("\n")
  const report = JSON.parse(lines.findLast((line) => line.startsWith('{"root":')))
  if (report.fixture_sha256 !== fixtureHash) throw new Error(`Fixture mismatch: ${name}`)
  const outcomes = new Map(report.results.flatMap((snapshot) => snapshot.outcomes.map((result) => [result.id, result])))
  if (outcomes.size !== report.results.reduce((total, snapshot) => total + snapshot.outcomes.length, 0)) throw new Error(`Duplicate case: ${name}`)
  const primary = cases.filter((item) => item.expected_sha256)
  const scored = primary.map((item) => ({ id: item.id, repo: item.repo, tool: item.tool, correct: outcomes.get(item.id)?.actual_sha256 === item.expected_sha256 }))
  for (const item of scored) {
    const observed = outcomes.get(item.id)
    if (observed && observed.correct !== item.correct) throw new Error(`Scorer disagreement: ${name}/${item.id}`)
  }
  return {
    name,
    revision: report.revision,
    source_sha256: report.source_sha256,
    source_files: report.source_files,
    runner_sha256: report.runner_sha256,
    snapshots: report.results.length,
    outcomes: outcomes.size,
    errors: report.results.filter((snapshot) => snapshot.error).map((snapshot) => ({ repo: snapshot.repo, error: snapshot.error })),
    correct: scored.filter((item) => item.correct).length,
    total: primary.length,
    changed_input_correct: primary.filter((item) => item.oracle_changes_input && outcomes.get(item.id)?.actual_sha256 === item.expected_sha256).length,
    changed_input_total: primary.filter((item) => item.oracle_changes_input).length,
    by_tool: Object.fromEntries(["black", "ruff"].map((tool) => [tool, {
      correct: scored.filter((item) => item.tool === tool && item.correct).length,
      total: scored.filter((item) => item.tool === tool).length,
    }])),
    scored,
    raw: Object.fromEntries(outcomes),
  }
})
const comparisons = []
const baseline = baselineName ?? ["latest-refreshed", "latest-current", "latest", "heldout-latest"].find((name) => versions.some((item) => item.name === name))
for (const [before, after] of [[beforeName, originalName], ...versions.filter((item) => ![beforeName, originalName, baseline].includes(item.name)).map((item) => [baseline, item.name])]) {
  const left = versions.find((item) => item.name === before)
  const right = versions.find((item) => item.name === after)
  if (!left || !right) continue
  if (left.runner_sha256 && right.runner_sha256 && left.runner_sha256 !== right.runner_sha256) throw new Error("Runner mismatch")
  const gains = right.scored.filter((item) => item.correct && !left.scored.find((previous) => previous.id === item.id)?.correct)
  const losses = right.scored.filter((item) => !item.correct && left.scored.find((previous) => previous.id === item.id)?.correct)
  const controls = cases.filter((item) => item.tool === null && !item.fixture_error)
  const changes = controls.filter((item) => {
    const previous = left.raw[item.id]
    const current = right.raw[item.id]
    return !previous || !current || previous.actual_sha256 !== current.actual_sha256 || previous.formatted !== current.formatted
  })
  comparisons.push({
    before,
    after,
    gains: gains.length,
    gaining_repositories: [...new Set(gains.map((item) => item.repo))],
    losses: losses.length,
    losing_repositories: [...new Set(losses.map((item) => item.repo))],
    preservation_controls: controls.length,
    changed_controls: changes.map((item) => ({ id: item.id, repo: item.repo, path: item.path })),
  })
}
const summary = {
  fixture_sha256: fixtureHash,
  files: cases.length,
  fixture_errors: cases.filter((item) => item.fixture_error).map((item) => ({ id: item.id, repo: item.repo, path: item.path, error: item.fixture_error })),
  versions: versions.map(({ scored, raw, ...version }) => version),
  comparisons,
}
fs.writeFileSync(path.join(root, outputPath), JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify(summary, null, 2))
