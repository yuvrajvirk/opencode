import path from "node:path"
import vm from "node:vm"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"

const roots = [path.join(import.meta.dir, "checkouts/latest"), "/home/yvirk2/opencode-worktrees/object-properties"]
const runtimes = await Promise.all(roots.map(async (checkout) => {
  const require = createRequire(path.join(checkout, "packages/codemode/package.json"))
  const { Effect } = await import(require.resolve("effect"))
  const { CodeMode } = await import(path.join(checkout, "packages/codemode/src/index.ts"))
  return { checkout, execute: (code: string) => Effect.runPromise(CodeMode.execute({ code, tools: {} })) }
}))
const fixtures = [
  { name: "ordinary indexed reads and writes", code: `const values = Array.from({length: 1024}, (_, index) => index); let total = 0; for (let repeat = 0; repeat < 4; repeat++) for (let index = 0; index < values.length; index++) { values[index]++; total += values[index] } return total;` },
  { name: "array callback pipeline", code: `const values = Array.from({length: 1024}, (_, index) => index); return values.map(value => value * 2).filter(value => value % 3 === 0).reduce((total, value) => total + value, 0);` },
  { name: "sealed array writes", code: `const values = Array.from({length: 1024}, (_, index) => index); Object.seal(values); let total = 0; for (let index = 0; index < values.length; index++) { values[index]++; total += values[index] } return total;` },
  { name: "frozen array reads", code: `const values = Object.freeze(Array.from({length: 1024}, (_, index) => index)); let total = 0; for (let index = 0; index < values.length; index++) total += values[index]; return total;` },
  { name: "array mutators", code: `const values = Array.from({length: 1024}, (_, index) => 1024 - index); values.sort((left, right) => left - right); values.reverse(); values.copyWithin(0, 512); values.fill(5, 512); return values.reduce((total, value) => total + value, 0);` },
]
const results = []
for (const fixture of fixtures) {
  const expected = vm.runInNewContext(`"use strict"; (function(){${fixture.code}})()`)
  for (const runtime of runtimes) {
    for (let warmup = 0; warmup < 3; warmup++) {
      const result = await runtime.execute(fixture.code)
      assert.equal(result.ok && result.value, expected)
    }
  }
  for (let round = 0; round < 9; round++) {
    const order = round % 2 ? [1, 0] : [0, 1]
    for (const version of order) {
      Bun.gc(true)
      const start = performance.now()
      for (let repeat = 0; repeat < 10; repeat++) {
        const result = await runtimes[version].execute(fixture.code)
        assert.equal(result.ok && result.value, expected)
      }
      results.push({ name: fixture.name, version: version === 0 ? "latest" : "candidate", round, milliseconds_per_execution: (performance.now() - start) / 10 })
    }
  }
}
const median = (values: Array<number>) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]
const summaries = fixtures.map((fixture) => {
  const latest = results.filter((result) => result.name === fixture.name && result.version === "latest")
  const candidate = results.filter((result) => result.name === fixture.name && result.version === "candidate")
  return { name: fixture.name, latest_ms: median(latest.map((result) => result.milliseconds_per_execution)), candidate_ms: median(candidate.map((result) => result.milliseconds_per_execution)), median_paired_ratio: median(candidate.map((result, position) => result.milliseconds_per_execution / latest[position].milliseconds_per_execution)) }
})
await Bun.write(path.join(import.meta.dir, "array-cost.json"), JSON.stringify({ runtime: `Bun ${Bun.version}`, roots, purpose: "Post-prototype synthetic regression diagnostic, not real-agent evidence or a claimed performance improvement. Five fixed existing-API programs, three warmups, nine alternating paired rounds, ten executions each, all checked against native output.", fixture_sha256: createHash("sha256").update(JSON.stringify(fixtures)).digest("hex"), fixtures, summaries, results }, null, 2) + "\n")
console.log(JSON.stringify(summaries))
