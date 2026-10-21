import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { CodeMode } from "../src/index.js"

const programs = [
  {
    name: "arguments retain identity and callback thisArg",
    code: `
      function collect() {
        const original = arguments
        return Array.prototype.map.call(arguments, function(value, index, receiver) {
          return [value * this.factor, index, receiver === original]
        }, { factor: 3 })
      }
      return collect(2, 4, 6)
    `,
  },
  {
    name: "inherited indexes participate while holes stay absent",
    code: `
      const input = Object.create({ 1: 7 })
      input[0] = 3
      input.length = 4
      const mapped = Array.prototype.map.call(input, value => value * 2)
      return [mapped, 2 in mapped, Array.prototype.reduce.call(input, (sum, value) => sum + value, 0)]
    `,
  },
  {
    name: "mutations are live but the initial length is fixed",
    code: `
      const input = { 0: 1, 1: 2, 2: 3, length: 3 }
      const seen = []
      Array.prototype.forEach.call(input, (value, index, receiver) => {
        seen.push([value, index, receiver === input])
        if (index === 0) {
          delete input[1]
          input[2] = 30
          input[3] = 40
          input.length = 4
        }
      })
      return seen
    `,
  },
  {
    name: "find methods visit holes while predicates skip them",
    code: `
      const input = { 1: 4, length: 3 }
      const visited = []
      const first = Array.prototype.findIndex.call(input, (value, index) => {
        visited.push(index)
        return value === 4
      })
      const last = Array.prototype.findLastIndex.call(input, value => value === undefined)
      return [first, last, visited, Array.prototype.every.call(input, value => value === 4),
        Array.prototype.some.call(input, value => value === undefined)]
    `,
  },
  {
    name: "reverse reductions skip holes and read future changes",
    code: `
      const input = { 0: 1, 2: 3, length: 3 }
      return Array.prototype.reduceRight.call(input, (sum, value, index, receiver) => {
        if (index === 2) input[0] = 10
        return sum + value + (receiver === input ? 0 : 100)
      }, 0)
    `,
  },
  {
    name: "length coercion precedes callback validation and happens once",
    code: `
      const seen = []
      const input = { 0: 2, 1: 4, length: { valueOf() { seen.push("length"); return 2.9 } } }
      const mapped = Array.prototype.map.call(input, value => value + 1)
      try { Array.prototype.map.call(input, null) } catch (error) { seen.push(error.name) }
      return [mapped, seen]
    `,
  },
  {
    name: "borrowed array callbacks retain typed array receivers",
    code: `
      const input = new Uint8Array([2, 4, 6])
      const mapped = Array.prototype.filter.call(input, (value, index, receiver) => receiver === input && index > 0)
      return [mapped, Array.isArray(mapped), Array.prototype.findLast.call(input, value => value < 6)]
    `,
  },
  {
    name: "read-only receivers and empty reductions match native behavior",
    code: `
      const input = Object.freeze({ 0: 9, length: "1" })
      const output = Array.prototype.map.call(input, value => value)
      try { Array.prototype.reduce.call({ length: 2 }, (sum, value) => sum + value) }
      catch (error) { return [output, error.name] }
    `,
  },
]

describe("generic Array callback methods", () => {
  for (const program of programs) {
    test(program.name, async () => {
      const expected = JSON.parse(JSON.stringify(new Function(`"use strict"; ${program.code}`)()))
      const result = await Effect.runPromise(CodeMode.execute({ code: program.code, tools: {} }))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toEqual(expected)
    })
  }

  test("retains confinement limits and missing-await diagnostics", async () => {
    for (const [code, message] of [
      ["Array.prototype.map.call({ length: 10000001 }, value => value)", "Invalid array length"],
      ["Array.prototype.map.call(Promise.resolve([1]), value => value)", "un-awaited Promise"],
    ]) {
      const result = await Effect.runPromise(CodeMode.execute({ code, tools: {} }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain(message)
    }
  })
})
