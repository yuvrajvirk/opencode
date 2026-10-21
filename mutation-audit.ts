import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"

const [checkout, label] = process.argv.slice(2)
if (!checkout || !label) throw new Error("Usage: bun mutation-audit.ts checkout label")
const require = createRequire(path.join(checkout, "packages/codemode/package.json"))
const { Effect } = await import(require.resolve("effect"))
const { CodeMode } = await import(path.join(checkout, "packages/codemode/src/index.ts"))
const starts = ["({ field: 1 })", "[1, 2, 3]", "new Uint8Array([1, 2, 3])"]
const names = ["field", "0", "1", "length", "-0", "4294967295"]
const descriptors = ["{}", "{value: 7}", "{writable: false}", "{enumerable: false}", "{configurable: false}", "{value: NaN, writable: false, configurable: false}", "{value: -0, writable: true, enumerable: true, configurable: true}"]
const operations = [
  "target[name] = 8", "delete target[name]", "Object.preventExtensions(target)",
  "Object.defineProperty(target, name, {value: 9})", "Object.seal(target)",
  "Object.freeze(target)", "target[name] = 10",
]
const cases = starts.flatMap((initial) => names.flatMap((name) => descriptors.map((descriptor) => ({
  name: `${initial}/${name}/${descriptor}`,
  code: `const target = ${initial}; const name = ${JSON.stringify(name)};
    let events = "";
    const snapshot = () => JSON.stringify([Object.getOwnPropertyNames(target), Object.getOwnPropertyDescriptors(target), Object.isExtensible(target)]);
    try { Object.defineProperty(target, name, ${descriptor}); events += "defined;" } catch (error) { events += error.name + ";" }
    events += snapshot() + "\\n";
    ${operations.map((operation) => `try { ${operation}; events += "ok;" } catch (error) { events += error.name + ";" } events += snapshot() + "\\n";`).join("\n")}
    return events;`,
}))))
for (const mutation of ["push(4)", "pop()", "shift()", "unshift(4)", "splice(0, 1)", "reverse()", "sort()", "fill(9)", "copyWithin(0, 1)"]) {
  for (const position of [0, 1, 2]) {
    for (const attributes of ["{ writable: false }", "{ configurable: false }", "{ enumerable: false }"]) {
      cases.push({ name: `${mutation}/${position}/${attributes}`, code: `
        const target = [3, 2, 1];
        Object.defineProperty(target, "${position}", ${attributes});
        let failure = "ok";
        try { target.${mutation} } catch (error) { failure = error.name }
        return JSON.stringify([failure, target, Object.getOwnPropertyDescriptors(target)]);
      ` })
    }
  }
}
cases.push({ name: "empty accessor descriptor", code: `
  const target = {}; Object.defineProperty(target, "field", { get: undefined, set: undefined });
  return JSON.stringify([target.field, Object.getOwnPropertyDescriptor(target, "field")]);
` })
const results = []
await Bun.write(path.join(import.meta.dir, "mutation-fixtures.json"), JSON.stringify(cases, null, 2) + "\n")
for (const entry of cases) {
  let expected
  try { expected = vm.runInNewContext(`"use strict"; (function() { ${entry.code} })()`, {}, { timeout: 5000 }) }
  catch (error) { results.push({ name: entry.name, code: entry.code, oracle_error: String(error) }); continue }
  const observed = await Effect.runPromise(CodeMode.execute({ code: entry.code, tools: {} }))
  results.push({ name: entry.name, code: entry.code, expected, actual: observed.ok ? observed.value : observed.error, correct: observed.ok && observed.value === expected })
}
const summary = { label, runtime: `Bun ${Bun.version}`, node_compatibility_version: process.version, fixture_sha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex"), total: results.length, oracle_errors: results.filter((entry) => entry.oracle_error).length, correct: results.filter((entry) => entry.correct).length }
await Bun.write(path.join(import.meta.dir, `mutation-${label}.json`), JSON.stringify({ ...summary, results }, null, 2) + "\n")
console.log(JSON.stringify(summary))
