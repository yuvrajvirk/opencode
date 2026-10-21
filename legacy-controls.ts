import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"

const roots = [path.join(import.meta.dir, "checkouts/latest"), "/home/yvirk2/opencode-worktrees/object-properties"]
const cases = ["-0", "4294967295", "field"].map((name) => ({ name, code: `
  const target = new Uint8Array([1, 2, 3]);
  target[${JSON.stringify(name)}] = 8;
  const assigned = [Array.from(target), Object.keys(target)];
  let sealed = "ok";
  try { Object.seal(target) } catch (error) { sealed = error.name }
  return JSON.stringify([assigned, sealed, Object.isExtensible(target)]);
` }))
const results = []
for (const checkout of roots) {
  const require = createRequire(path.join(checkout, "packages/codemode/package.json"))
  const { Effect } = await import(require.resolve("effect"))
  const { CodeMode } = await import(path.join(checkout, "packages/codemode/src/index.ts"))
  for (const entry of cases) {
    const result = await Effect.runPromise(CodeMode.execute({ code: entry.code, tools: {} }))
    results.push({ checkout, name: entry.name, actual: result.ok ? result.value : result.error, native_bun: vm.runInNewContext(`"use strict";(function(){${entry.code}})()`) })
  }
}
await Bun.write(path.join(import.meta.dir, "legacy-controls.json"), JSON.stringify({ cases, results }, null, 2) + "\n")
console.log(JSON.stringify(results))
