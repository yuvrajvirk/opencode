import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"
import { CodeMode, OpenAPI, Tool } from "../src/index.js"

const mediaType = "application/x-www-form-urlencoded"
const schema = {
  type: "object",
  properties: {
    text: { type: "string" },
    count: { type: "integer" },
    enabled: { type: "boolean" },
    tags: { type: "array", items: { type: "string" } },
  },
}

function fixture(body: Record<string, unknown>, required = false) {
  const requests: { headers: Record<string, string>; body: string | undefined }[] = []
  const auth: string[] = []
  const client = Layer.succeed(HttpClient.HttpClient)(
    HttpClient.make((request) =>
      Effect.sync(() => {
        requests.push({
          headers: { ...request.headers },
          body: request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : undefined,
        })
        return HttpClientResponse.fromWeb(request, new Response("ok"))
      }),
    ),
  )
  const adapted = OpenAPI.fromSpec({
    baseUrl: "https://capture.invalid",
    spec: {
      openapi: "3.1.0",
      components: {
        schemas: { Form: schema },
        securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      },
      security: [{ bearer: [] }],
      paths: {
        "/submit": {
          post: {
            operationId: "submit",
            requestBody: { required, content: body },
            responses: { 200: { description: "Captured" } },
          },
        },
      },
    },
    auth: {
      resolve: ({ name }) =>
        Effect.sync(() => {
          auth.push(name)
          return { type: "bearer" as const, token: "fixture" }
        }),
    },
  })
  const invoke = (input: unknown) => {
    const tool = adapted.tools.submit
    if (!Tool.isTool(tool)) throw new Error("No form tool generated")
    return Effect.runPromise(tool.execute(input).pipe(Effect.provide(client)))
  }
  return { ...adapted, requests, auth, client, invoke }
}

describe("OpenAPI URL-encoded bodies", () => {
  test("executes form tools from CodeMode with typed fields and repeated arrays", async () => {
    const sample = fixture({ [mediaType]: { schema } })
    const runtime = CodeMode.make({ tools: sample.tools })
    const result = await Effect.runPromise(
      runtime
        .execute(
          'await tools.submit({ body: { text: "hello +&=☃", count: 0, enabled: false, tags: ["one", "two"] } })',
        )
        .pipe(Effect.provide(sample.client)),
    )
    expect(result.ok).toBe(true)
    expect(sample.requests).toHaveLength(1)
    expect(sample.requests[0].headers["content-type"]).toBe(mediaType)
    expect([...new URLSearchParams(sample.requests[0].body)]).toEqual([
      ["text", "hello +&=☃"],
      ["count", "0"],
      ["enabled", "false"],
      ["tags", "one"],
      ["tags", "two"],
    ])
    expect(sample.auth).toEqual(["bearer"])
  })

  test("preserves reserved names, Unicode replacement, empty strings, and comma-delimited arrays", async () => {
    const sample = fixture({ [mediaType]: { schema, encoding: { tags: { style: "form", explode: false } } } })
    const body = Object.fromEntries([
      ["text", " \ud800🧪~!*'()"],
      ["__proto__", "safe"],
      ["constructor", ""],
      ["a&b=+", "value"],
      ["tags", ["a,b", "c"]],
    ])
    await sample.invoke({ body })
    const parameters = new URLSearchParams(sample.requests[0].body)
    expect(parameters.get("text")).toBe(" �🧪~!*'()")
    expect(parameters.get("__proto__")).toBe("safe")
    expect(parameters.get("constructor")).toBe("")
    expect(parameters.get("a&b=+")).toBe("value")
    expect(parameters.getAll("tags")).toEqual(["a,b,c"])
    expect([...parameters]).toHaveLength(5)
  })

  test("preserves optional omission and required empty bodies", async () => {
    const optional = fixture({ [mediaType]: { schema } })
    await optional.invoke({})
    expect(optional.requests[0].body).toBeUndefined()
    expect(optional.requests[0].headers["content-type"]).toBeUndefined()
    const required = fixture(
      { [mediaType]: { schema: { type: "object", properties: {}, additionalProperties: false } } },
      true,
    )
    await required.invoke({})
    expect(required.requests[0].body).toBe("")
    expect(required.requests[0].headers["content-type"]).toBe(mediaType)
  })

  test("keeps flattened required fields and root schema references", async () => {
    const flattened = fixture(
      { [mediaType]: { schema: { ...schema, required: ["text"], additionalProperties: false } } },
      true,
    )
    await expect(flattened.invoke({})).rejects.toThrow("Missing required body field")
    expect(flattened.auth).toEqual([])
    await flattened.invoke({ text: "value" })
    expect(flattened.requests[0].body).toBe("text=value")
    const referenced = fixture({ [mediaType]: { schema: { $ref: "#/components/schemas/Form" } } })
    await referenced.invoke({ body: { count: 2 } })
    expect(referenced.requests[0].body).toBe("count=2")
  })

  test("prefers JSON when both body formats are offered", async () => {
    const sample = fixture({ [mediaType]: { schema }, "application/json": { schema } })
    await sample.invoke({ body: { count: 2 } })
    expect(sample.requests[0].headers["content-type"]).toBe("application/json")
    expect(JSON.parse(sample.requests[0].body ?? "")).toEqual({ count: 2 })
  })

  test("does not silently JSON-encode object fields with their default content type", async () => {
    const sample = fixture({
      [mediaType]: {
        schema: {
          type: "object",
          properties: { metadata: { type: "object", properties: { label: { type: "string" } } } },
        },
      },
    })
    await expect(sample.invoke({ body: { metadata: { label: "value" } } })).rejects.toThrow("unsupported value")
    expect(sample.auth).toEqual([])
    expect(sample.requests).toEqual([])
  })

  test.each(
    [
      null,
      [],
      "text",
      { text: null },
      { text: {} },
      { tags: [["nested"]] },
      { text: undefined },
      { count: Infinity },
      { count: NaN },
    ].map((body) => ({ body })),
  )("rejects unsupported values before auth and transport: %j", async (input) => {
    const sample = fixture({ [mediaType]: { schema } })
    await expect(sample.invoke(input)).rejects.toThrow("URL-encoded")
    expect(sample.auth).toEqual([])
    expect(sample.requests).toEqual([])
  })

  test.each([
    { type: "array", items: { type: "string" } },
    { properties: { text: { type: "string" } } },
    { $ref: "#/components/schemas/Missing" },
  ])("reports unsupported root schemas rather than guessing: %j", (schema) => {
    const sample = fixture({ [mediaType]: { schema } })
    expect(sample.skipped[0].reason).toBe("URL-encoded request body must be an object")
    expect(sample.tools).toEqual({})
  })

  test.each(
    [
      { text: { style: "deepObject" } },
      { text: { style: "pipeDelimited" } },
      { text: { allowReserved: true } },
      { text: { explode: "false" } },
      { text: { contentType: "application/json" } },
      { text: { contentType: "text/plain" } },
      { text: null },
      [],
    ].map((encoding) => ({ encoding })),
  )("reports unsupported encodings rather than emitting incorrect bodies: %j", (input) => {
    const sample = fixture({ [mediaType]: { schema, encoding: input.encoding } })
    expect(sample.skipped).toHaveLength(1)
    expect(sample.tools).toEqual({})
  })
})
