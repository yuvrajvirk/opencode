import { expect, test } from "bun:test"
import { Effect } from "effect"
import { CodeMode } from "../src/index.js"

const value = async (code: string) => {
  const result = await Effect.runPromise(CodeMode.execute({ code, tools: {} }))
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

test("constructs hidden, immutable data properties without changing prototypes", async () => {
  expect(
    await value(`
    const prototype = { inherited: true }
    const target = Object.create(prototype, { field: { value: 7 } })
    let immutable = false
    try { target.field = 8 } catch (error) { immutable = error instanceof TypeError }
    return [target.field, Object.keys(target), Object.getOwnPropertyNames(target), immutable, Object.getPrototypeOf(target) === prototype]
  `),
  ).toEqual([7, [], ["field"], true, true])
})

test("validates all property descriptions before making changes", async () => {
  expect(
    await value(`
    const target = {}
    try { Object.defineProperties(target, { first: { value: 1 }, second: null }) } catch {}
    return Object.getOwnPropertyNames(target)
  `),
  ).toEqual([])
})

test("empty accessor descriptions do not require exposing a global object", async () => {
  expect(
    await value(`
    const target = Object.create({}, { field: { set: this } })
    const descriptor = Object.getOwnPropertyDescriptor(target, "field")
    return [typeof this, typeof target.field, "set" in descriptor, descriptor.enumerable, descriptor.configurable]
  `),
  ).toEqual(["undefined", "undefined", true, false, false])
})

test("tracks per-index attributes through array mutations", async () => {
  expect(
    await value(`
    const target = [1, 2, 3]
    Object.defineProperty(target, "1", { value: 5, enumerable: false, writable: false })
    let rejected = false
    try { target.fill(9) } catch (error) { rejected = error instanceof TypeError }
    return [target, Object.keys(target), Object.getOwnPropertyNames(target), rejected, Object.getOwnPropertyDescriptor(target, "1").writable]
  `),
  ).toEqual([[9, 5, 3], ["0", "2"], ["0", "1", "2", "length"], true, false])
})

test("array length conversion invokes program coercion twice", async () => {
  expect(
    await value(`
    const target = [1, 2, 3]
    let conversions = 0
    Object.defineProperty(target, "length", { value: { valueOf() { conversions++; return 2 } } })
    return [target, conversions]
  `),
  ).toEqual([[1, 2], 2])
})

test("byte descriptors update confined bytes through numeric conversion", async () => {
  expect(
    await value(`
    const target = new Uint8Array([0])
    let conversions = 0
    Object.defineProperty(target, "0", { value: { valueOf() { conversions++; return 258 } } })
    try { Object.defineProperty(target, "0", { configurable: false, value: { valueOf() { conversions++; return 4 } } }) } catch {}
    return [target[0], conversions]
  `),
  ).toEqual([2, 1])
})

test("string inspection uses UTF-16 units and immutable index descriptors", async () => {
  expect(
    await value(`
    const descriptors = Object.getOwnPropertyDescriptors("🐍")
    return [Object.getOwnPropertyNames("🐍"), descriptors.length.value, descriptors[0].value.charCodeAt(0), descriptors[0].writable, descriptors[0].configurable]
  `),
  ).toEqual([["0", "1", "length"], 2, 0xd83d, false, false])
})

test("native accessor reflection exposes confined callables with stable identity", async () => {
  expect(
    await value(`
    const getter = Object.getOwnPropertyDescriptor(Map.prototype, "size").get
    const repeated = Object.getOwnPropertyDescriptor(Map.prototype, "size").get
    return [typeof getter, getter === repeated, getter.call(new Map([["key", 1]]))]
  `),
  ).toEqual(["function", true, 1])
})

test("property inspection cannot reveal tool paths or pending promise internals", async () => {
  for (const target of ["tools", "tools.private", "Promise.resolve(1)"]) {
    for (const operation of [
      `Object.getOwnPropertyNames(${target})`,
      `Object.getOwnPropertyDescriptors(${target})`,
      `Object.getOwnPropertyDescriptor(${target}, "path")`,
    ]) {
      const result = await Effect.runPromise(CodeMode.execute({ code: `return ${operation}`, tools: {} }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain("awaited data object")
    }
  }
})

test("reflected native accessors retain receiver checks and confined constructors", async () => {
  expect(
    await value(`
    const getter = Object.getOwnPropertyDescriptor(Map.prototype, "size").get
    let rejected = 0
    try { getter.call({}) } catch (error) { rejected += error instanceof TypeError ? 1 : 0 }
    try { getter.constructor("return process")() } catch { rejected++ }
    return [rejected, Object.getOwnPropertyNames(getter).sort(), typeof getter.call]
  `),
  ).toEqual([2, ["length", "name"], "function"])
})

test("single-property inspection does not enumerate a long primitive string", async () => {
  expect(
    await value(`
    const text = "x".repeat(10000001)
    const descriptor = Object.getOwnPropertyDescriptor(text, "length")
    let bounded = false
    try { Object.getOwnPropertyNames(text) } catch (error) { bounded = error instanceof RangeError }
    return [descriptor.value, Object.getOwnPropertyDescriptor(text, "10000000").value, bounded]
  `),
  ).toEqual([10000001, "x", true])
})

test("data-property creation preserves cycle and array-size limits", async () => {
  const circular = await Effect.runPromise(
    CodeMode.execute({
      code: `const target = {}; Object.defineProperty(target, "self", { value: target })`,
      tools: {},
    }),
  )
  expect(circular.ok).toBe(false)
  if (!circular.ok) expect(circular.error.message).toContain("circular")
  expect(
    await value(`
    const target = []
    let rejected = false
    try { Object.defineProperty(target, "10000000", { value: 1 }) } catch (error) { rejected = error instanceof RangeError }
    return [rejected, target.length]
  `),
  ).toEqual([true, 0])
})
