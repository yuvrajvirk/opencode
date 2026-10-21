import fs from "node:fs/promises"
import vm from "node:vm"
import { createHash } from "node:crypto"
import { wrap } from "./holdout-wrapper.mjs"

const bytes = await fs.readFile(new URL("./holdout-fixtures.json", import.meta.url))
const fixtures = JSON.parse(bytes)
const results = fixtures.map((fixture) => {
  try {
    const serialized = vm.runInNewContext(`"use strict"; (function() { ${wrap(fixture.code)} })()`, {}, { timeout: 5000 })
    const observation = JSON.parse(serialized)
    return { id: fixture.id, observation, primary: observation.observations.length > 0 && observation.exception !== "ReferenceError" }
  } catch (error) {
    return { id: fixture.id, error: { name: error.name, message: error.message }, primary: false }
  }
})
const result = {
  runtime: process.version,
  fixture_sha256: createHash("sha256").update(bytes).digest("hex"),
  wrapper_sha256: createHash("sha256").update(await fs.readFile(new URL("./holdout-wrapper.mjs", import.meta.url))).digest("hex"),
  total: results.length,
  primary: results.filter((result) => result.primary).length,
  results,
}
await fs.writeFile(new URL("./holdout-native.json", import.meta.url), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ runtime: result.runtime, total: result.total, primary: result.primary, errors: results.filter((entry) => entry.error).length }))
