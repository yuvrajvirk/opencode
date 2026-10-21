import path from "node:path"
import vm from "node:vm"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { wrap } from "./holdout-wrapper.mjs"

const checkout = process.argv[2]
const require = createRequire(path.join(checkout, "packages/codemode/package.json"))
const { Effect } = await import(require.resolve("effect"))
const { CodeMode } = await import(path.join(checkout, "packages/codemode/src/index.ts"))
const sources = [
  'console.log(1, "text", undefined, NaN, Infinity, Symbol.iterator);',
  'console.info({nested: [1, undefined], callable: function named(first, second) {}});',
  'const target = {field: 1}; console.warn(target); target.field = 2; console.log(target);',
  'console.log("before"); throw new TypeError("expected");',
  'console.log(missingContext);',
  'const noObservation = 1;',
]
for (const source of sources) {
  const expected = vm.runInNewContext(`"use strict";(function(){${wrap(source)}})()`)
  const result = await Effect.runPromise(CodeMode.execute({ code: wrap(source), tools: {} }))
  assert.equal(result.ok && result.value, expected)
}
console.log(JSON.stringify({ checkout, controls: sources.length, pass: sources.length }))
