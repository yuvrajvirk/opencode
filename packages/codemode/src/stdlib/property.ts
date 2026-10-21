export * as ObjectProperty from "./property.js"

import { Effect } from "effect"
import { typeError, invalidData, rangeError } from "../interpreter/model.js"
import { fn } from "../interpreter/native.js"
import { toPrimitiveString, toPrimitiveNumber } from "../interpreter/callback.js"
import { checkArrayLength } from "../interpreter/limits.js"
import type { Interpreter } from "../interpreter/interpreter.js"
import {
  Arr,
  Obj,
  PromiseObj,
  define,
  get,
  has,
  own,
  ownKeys,
  parseArrayIndex,
  type Descriptor,
  type Getter,
  type Setter,
  type Slot,
  type Value,
} from "../interpreter/objects.js"
import { rejectCircularInsertion } from "../interpreter/references.js"
import { ToolReference } from "../tool-runtime.js"

const source = <R>(ctx: Interpreter<R>, value: Value): Obj | string => {
  if (value === null || value === undefined) throw typeError("Cannot convert undefined or null to object.")
  if (value instanceof ToolReference || value instanceof PromiseObj)
    throw invalidData("Property inspection requires an awaited data object.")
  if (value instanceof Obj) return value
  return typeof value === "string" ? value : new Obj(ctx.builtins.Object)
}

const slot = (target: Obj | string, name: string | symbol): Slot | undefined => {
  if (typeof target !== "string") return own(target, name)
  if (name === "length") return { value: target.length, writable: false, enumerable: false, configurable: false }
  const index = typeof name === "string" ? parseArrayIndex(name) : undefined
  return index !== undefined && index < target.length
    ? { value: target[index], writable: false, enumerable: true, configurable: false }
    : undefined
}

const names = (target: Obj | string): Array<string | symbol> => {
  if (typeof target !== "string") return ownKeys(target)
  checkArrayLength(target.length + 1)
  return [...Array.from({ length: target.length }, (_, index) => String(index)), "length"]
}

const key = <R>(ctx: Interpreter<R>, value: Value) =>
  typeof value === "symbol" ? Effect.succeed(value) : toPrimitiveString(ctx, value)

const descriptor = (value: Value): Descriptor => {
  if (!(value instanceof Obj)) throw typeError("Property description must be an object.")
  const result: Descriptor = {}
  if (has(value, "enumerable")) result.enumerable = Boolean(get(value, "enumerable"))
  if (has(value, "configurable")) result.configurable = Boolean(get(value, "configurable"))
  if (has(value, "value")) result.value = get(value, "value")
  if (has(value, "writable")) result.writable = Boolean(get(value, "writable"))
  for (const name of ["get", "set"] as const) {
    if (!has(value, name)) continue
    if (get(value, name) !== undefined) throw typeError("Program-defined accessor descriptors are not supported.")
    result[name] = undefined
  }
  if (("get" in result || "set" in result) && ("value" in result || "writable" in result))
    throw typeError("Invalid property descriptor: cannot specify both accessors and a value or writable attribute.")
  return result
}

const apply = <R>(ctx: Interpreter<R>, target: Obj, name: string | symbol, descriptor: Descriptor) =>
  Effect.gen(function* () {
    const coercion = target.definitionCoercion(name, descriptor)
    const numeric = coercion === undefined ? undefined : yield* toPrimitiveNumber(ctx, descriptor.value)
    if (coercion === "length" && (numeric ?? 0) >>> 0 !== (yield* toPrimitiveNumber(ctx, descriptor.value)))
      throw rangeError("Invalid array length")
    const changes = coercion === undefined ? descriptor : { ...descriptor, value: numeric }
    const current = own(target, name)
    const accessor = "get" in changes || "set" in changes
    const data = "value" in changes || "writable" in changes
    const incompatible = () => {
      throw typeError(`Cannot redefine property: ${String(name)}`)
    }
    if (current === undefined && !target.extensible) incompatible()
    if (current !== undefined && !current.configurable) {
      if (changes.configurable || (changes.enumerable !== undefined && changes.enumerable !== current.enumerable))
        incompatible()
      if ("value" in current) {
        if (accessor) incompatible()
        if (!current.writable && (changes.writable || ("value" in changes && !Object.is(changes.value, current.value))))
          incompatible()
      } else {
        if (
          data ||
          ("get" in changes && current.get !== changes.get) ||
          ("set" in changes && current.set !== changes.set)
        )
          incompatible()
      }
    }
    if ("value" in changes) rejectCircularInsertion(target, changes.value, "Object property")
    const base =
      current !== undefined && !(accessor && "value" in current) && !(data && !("value" in current))
        ? current
        : accessor
          ? {
              get: undefined,
              set: undefined,
              enumerable: current?.enumerable ?? false,
              configurable: current?.configurable ?? false,
            }
          : {
              value: undefined,
              writable: false,
              enumerable: current?.enumerable ?? false,
              configurable: current?.configurable ?? false,
            }
    target.redefine(name, { ...base, ...changes })
  })

export const make = <R>(ctx: Interpreter<R>) => {
  const accessors = new WeakMap<Getter | Setter, Value>()
  const read = (target: Obj | string, name: string | symbol): Value => {
    const property = slot(target, name)
    if (property === undefined) return undefined
    const result = new Obj(ctx.builtins.Object)
    if ("value" in property) {
      define(result, "value", property.value)
      define(result, "writable", property.writable)
    } else {
      for (const kind of ["get", "set"] as const) {
        const accessor = property[kind]
        if (accessor === undefined) {
          define(result, kind, undefined)
          continue
        }
        const cached = accessors.get(accessor)
        const callable =
          cached ??
          fn(ctx.builtins, `${kind} ${String(name)}`, kind === "get" ? 0 : 1, (receiver, args) =>
            kind === "get" ? property.get?.(receiver) : (property.set?.(receiver, args[0]), undefined),
          )
        accessors.set(accessor, callable)
        define(result, kind, callable)
      }
    }
    define(result, "enumerable", property.enumerable)
    define(result, "configurable", property.configurable)
    return result
  }
  const defineProperties = (target: Value, properties: Value) =>
    Effect.gen(function* () {
      if (!(target instanceof Obj)) throw typeError("Object.defineProperties called on non-object.")
      const input = source(ctx, properties)
      const entries = names(input)
        .filter((name) => slot(input, name)?.enumerable)
        .map((name) => [name, descriptor(typeof input === "string" ? input[Number(name)] : get(input, name))] as const)
      for (const [name, value] of entries) yield* apply(ctx, target, name, value)
      return target
    })
  return {
    defineProperties,
    defineProperty: (target: Value, property: Value, attributes: Value) =>
      Effect.gen(function* () {
        if (!(target instanceof Obj)) throw typeError("Object.defineProperty called on non-object.")
        const name = yield* key(ctx, property)
        yield* apply(ctx, target, name, descriptor(attributes))
        return target
      }),
    getOwnPropertyDescriptor: (target: Value, property: Value) =>
      Effect.gen(function* () {
        const object = source(ctx, target)
        return read(object, yield* key(ctx, property))
      }),
    getOwnPropertyDescriptors: (target: Value) => {
      const object = source(ctx, target)
      const result = new Obj(ctx.builtins.Object)
      for (const name of names(object)) define(result, name, read(object, name))
      return result
    },
    getOwnPropertyNames: (target: Value) =>
      new Arr(
        ctx.builtins.Array,
        names(source(ctx, target)).filter((name) => typeof name === "string"),
      ),
  }
}
