import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"

const root = new URL(".", import.meta.url).pathname
const experiment = process.argv[2] ?? "weighted"
const directory = path.join(root, `cost-${experiment}`)
const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]
const canonical = (record) => record.results.map((item) => ({
  id: item.id, profile: item.profile, error: Boolean(item.error),
  stages: item.stages.map(({ elapsed_ms, ...stage }) => stage),
  retained_unique_blob_bytes: item.retained_unique_blob_bytes,
  retained_document_bytes: item.retained_document_bytes,
}))
const old = Object.fromEntries([['latest', 'latest-refreshed'], ['candidate', `variant-${experiment}`]].map(([label, name]) => [label, JSON.parse(fs.readFileSync(path.join(root, `${name}.log`)))]))
const results = []
const load = (engine, round, label) => {
  const name = `${engine}-${round === 0 ? "warmup" : round}-${label}`
  const data = JSON.parse(fs.readFileSync(path.join(directory, `${name}.json`)))
  const time = fs.readFileSync(path.join(directory, `${name}.time`), "utf8")
  const field = (expression) => {
    const match = time.match(expression)
    assert(match, name)
    return Number(match[1])
  }
  assert.equal(data.fixture_sha256, old[label].fixture_sha256)
  assert.equal(data.source_sha256, old[label].source_sha256)
  assert.deepEqual(canonical(data), canonical(old[label]), `${name}: outcome or byte parity changed`)
  return {
    ...data,
    process: {
      user_seconds: field(/User time \(seconds\): ([\d.]+)/),
      system_seconds: field(/System time \(seconds\): ([\d.]+)/),
      max_rss_kib: field(/Maximum resident set size \(kbytes\): (\d+)/),
    },
  }
}
for (const engine of ["bun", "node"]) {
  load(engine, 0, "latest")
  load(engine, 0, "candidate")
  const pairs = Array.from({ length: 5 }, (_, index) => ({ latest: load(engine, index + 1, "latest"), candidate: load(engine, index + 1, "candidate") }))
  const groups = []
  for (const band of ["small", "medium", "large"]) {
    for (const profile of ["append", "prepend", "middle", "delete", "replace"]) {
      const samples = pairs.map(({ latest, candidate }) => {
        assert.equal(latest.worker_sha256, candidate.worker_sha256)
        const previous = new Map(latest.results.map((item) => [`${item.id}/${item.profile}`, item]))
        const selected = candidate.results.filter((item) => item.band === band && item.profile === profile && !item.error && !previous.get(`${item.id}/${item.profile}`).error)
        const elapsed = (items) => items.flatMap((item) => item.stages.filter((stage) => stage.phase === "edit")).reduce((total, stage) => total + stage.elapsed_ms, 0)
        const before = elapsed(selected.map((item) => previous.get(`${item.id}/${item.profile}`)))
        const after = elapsed(selected)
        return { before_ms: before, after_ms: after, ratio: after / before, matched_scenarios: selected.length }
      })
      groups.push({ band, profile, median_before_ms: median(samples.map((item) => item.before_ms)), median_after_ms: median(samples.map((item) => item.after_ms)), median_paired_ratio: median(samples.map((item) => item.ratio)), samples })
    }
  }
  results.push({
    engine, groups,
    whole_process: pairs.map(({ latest, candidate }) => ({ latest: latest.process, candidate: candidate.process })),
    median_max_rss_kib: { latest: median(pairs.map((item) => item.latest.process.max_rss_kib)), candidate: median(pairs.map((item) => item.candidate.process.max_rss_kib)) },
  })
}
const report = { parity: "Every run has identical exactness, expected-document hashes, submitted bytes, calls and retained bytes to the original Bun development runs; only platform/reporting code changed", results }
fs.writeFileSync(path.join(root, `cost-${experiment}-summary.json`), JSON.stringify(report, null, 2) + "\n")
for (const result of results) {
  console.log(result.engine, result.median_max_rss_kib)
  for (const group of result.groups) console.log(`${group.band}/${group.profile}: ${group.median_before_ms.toFixed(2)} -> ${group.median_after_ms.toFixed(2)} ms; paired ratio ${group.median_paired_ratio.toFixed(3)}`)
}
