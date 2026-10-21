import fs from "node:fs"
import path from "node:path"

const root = new URL(".", import.meta.url).pathname
const names = process.argv.slice(2)
const versions = (names.length ? names : ["before", "original", "latest"]).map((name) => JSON.parse(fs.readFileSync(path.join(root, `${name}.json`))))
const baseline = versions.find((item) => item.name === "latest")
const pairs = [[versions.find((item) => item.name === "before"), versions.find((item) => item.name === "original")], ...versions.filter((item) => !["before", "original", "latest"].includes(item.name)).map((item) => [baseline, item])]
const comparisons = pairs.filter(([left, right]) => left && right).map(([left, right]) => {
  if (left.fixture_sha256 !== right.fixture_sha256 || left.runner_sha256 !== right.runner_sha256) throw new Error("Unmatched comparison inputs")
  const previous = new Map(left.results.map((item) => [item.file, item]))
  const gains = right.results.filter((item) => item.status === "pass" && previous.get(item.file)?.status === "fail").map((item) => item.file)
  const losses = right.results.filter((item) => item.status === "fail" && previous.get(item.file)?.status === "pass").map((item) => item.file)
  if (right.results.length !== previous.size || right.results.some((item) => !previous.has(item.file))) throw new Error("Mismatched case set")
  return { before: left.name, after: right.name, gains: gains.length, losses: losses.length, gaining_files: gains, losing_files: losses }
})
const summary = { versions: versions.map(({ results, ...summary }) => summary), comparisons }
fs.writeFileSync(path.join(root, "comparison.json"), JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify({ versions: versions.map(({ name, pass, total }) => ({ name, pass, total })), comparisons: comparisons.map(({ before, after, gains, losses }) => ({ before, after, gains, losses })) }))
