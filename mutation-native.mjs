import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createHash } from "node:crypto"

const root = new URL(".", import.meta.url).pathname
const cases = JSON.parse(fs.readFileSync(path.join(root, "mutation-fixtures.json")))
const candidate = JSON.parse(fs.readFileSync(path.join(root, "mutation-native-integrity.json")))
const results = cases.map((entry, index) => {
  if (entry.name !== candidate.results[index].name || entry.code !== candidate.results[index].code) throw new Error("Fixture mismatch")
  try {
    const expected = vm.runInNewContext(`"use strict"; (function() { ${entry.code} })()`, {}, { timeout: 5000 })
    return { name: entry.name, expected, agrees_with_bun: expected === candidate.results[index].expected, candidate_correct: candidate.results[index].actual === expected }
  } catch (error) {
    return { name: entry.name, oracle_error: String(error) }
  }
})
const summary = {
  runtime: process.version, fixture_sha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex"), total: results.length,
  oracle_errors: results.filter((entry) => entry.oracle_error).length,
  native_agreement: results.filter((entry) => entry.agrees_with_bun).length,
  candidate_correct: results.filter((entry) => entry.candidate_correct).length,
}
fs.writeFileSync(path.join(root, "mutation-node.json"), JSON.stringify({ ...summary, results }, null, 2) + "\n")
console.log(JSON.stringify(summary))
