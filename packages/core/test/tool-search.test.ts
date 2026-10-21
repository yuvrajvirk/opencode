import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer, Schema } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Environment } from "@opencode/core/environment/index"
import { FileSystem } from "@opencode/core/filesystem"
import { Location } from "@opencode/core/location"
import { FileAccess } from "@opencode/core/file-access"
import { Permission } from "@opencode/core/permission"
import { Ripgrep } from "@opencode/core/ripgrep"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { GlobTool } from "@opencode/core/tool/plugin/glob"
import { GrepTool } from "@opencode/core/tool/plugin/grep"
import { Tool } from "@opencode/core/tool"
import { location } from "./fixture/location"
import { tmpdir, tmpdirScoped } from "./fixture/tmpdir"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"

const globToolNode = makeLocationNode({
  name: "test/glob-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GlobTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const grepToolNode = makeLocationNode({
  name: "test/grep-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GrepTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const sessionID = Session.ID.make("ses_search_tool_test")

const withTools = <A, E, R>(
  directory: string,
  body: (registry: Tool.Interface) => Effect.Effect<A, E, R>,
  assertions?: Permission.AssertInput[],
) =>
  Effect.gen(function* () {
    const registry = yield* Tool.Service
    return yield* body(registry)
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(LayerNode.group([Tool.node, globToolNode, grepToolNode]), [
        Location.node.replace(
          Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
        ),
        Permission.node.replace(
          permissionLayer({
            assert: (input) =>
              Effect.sync(() => {
                assertions?.push(input)
              }),
          }),
        ),
      ]),
    ),
  )

const call = (name: "glob" | "grep", input: unknown) => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id: `call-${name}`, name, input },
})

describe("search tools", () => {
  for (const limit of [2, 3]) {
    it.live(`grep file output limits files rather than matching lines at ${limit}`, () =>
      Effect.gen(function* () {
        const tmp = yield* tmpdirScoped()
        yield* Effect.promise(() =>
          Promise.all(
            ["first.txt", "second.txt", "third.txt"].map((file) =>
              Bun.write(path.join(tmp.path, file), "needle\n".repeat(150)),
            ),
          ),
        )
        yield* withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            const result = yield* executeTool(registry, call("grep", { pattern: "needle", outputMode: "files", limit }))
            expect(result.status).toBe("completed")
            expect(result.output).toHaveLength(limit)
            const entries = yield* Schema.decodeUnknownEffect(Schema.Array(FileSystem.Entry))(result.output)
            expect(["first.txt", "second.txt", "third.txt"].map((file) => ({ path: file, type: "file" }))).toEqual(
              expect.arrayContaining(entries),
            )
            expect(new Set(entries.map((entry) => entry.path)).size).toBe(limit)
            expect(result.metadata).toEqual({ files: limit, truncated: limit < 3 })
            const text = result.content?.[0]?.type === "text" ? result.content[0].text : ""
            expect(text).not.toContain("Line ")
            expect(text).not.toContain("needle")
            expect(text.includes("Results are truncated")).toBe(limit < 3)
          }),
        )
      }),
    )
  }

  it.live("preserves default grep output when content mode is explicit", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      yield* Effect.promise(() => Bun.write(path.join(tmp.path, "file.txt"), "needle\nneedle\n"))
      yield* withTools(tmp.path, (registry) =>
        Effect.gen(function* () {
          const input = { pattern: "needle", path: "file.txt" }
          expect(yield* executeTool(registry, call("grep", { ...input, outputMode: "content" }))).toEqual(
            yield* executeTool(registry, call("grep", input)),
          )
        }),
      )
    }),
  )

  it.live("grep file output preserves matching options and escaped filenames", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      const filenames = [
        ".hidden/with space.ts",
        "src/雪.ts",
        ...(process.platform === "win32" ? [] : ["src/colon:name\nnext.ts", "src/back\\slash.ts"]),
      ]
      yield* Effect.promise(() =>
        Promise.all([
          ...filenames.map((file) => Bun.write(path.join(tmp.path, file), "a.b\na.b\n")),
          Bun.write(path.join(tmp.path, "skip.ts"), "axb\n"),
          Bun.write(path.join(tmp.path, "skip.txt"), "a.b\n"),
          Bun.write(path.join(tmp.path, ".git/config.ts"), "a.b\n"),
        ]),
      )
      yield* withTools(tmp.path, (registry) =>
        Effect.gen(function* () {
          const result = yield* executeTool(
            registry,
            call("grep", { pattern: "A.B", literal: true, caseSensitive: false, include: "*.ts", outputMode: "files" }),
          )
          expect(result.status).toBe("completed")
          expect(result.output).toEqual(
            expect.arrayContaining(filenames.map((file) => ({ path: path.normalize(file), type: "file" }))),
          )
          expect(result.metadata).toEqual({ files: filenames.length, truncated: false })
          const text = result.content?.[0]?.type === "text" ? result.content[0].text : ""
          expect(
            text
              .split("\n")
              .slice(1)
              .map((line) => JSON.parse(line))
              .sort(),
          ).toEqual(filenames.map((file) => path.join(tmp.path, file)).sort())
          const file = yield* executeTool(
            registry,
            call("grep", { pattern: "a.b", path: filenames[0], outputMode: "files" }),
          )
          expect(file).toMatchObject({
            status: "completed",
            output: [{ path: path.normalize(filenames[0]!), type: "file" }],
            metadata: { files: 1, truncated: false },
          })
        }),
      )
    }),
  )

  it.live("grep file output reports empty results and preserves argument errors", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      yield* Effect.promise(() => Bun.write(path.join(tmp.path, "file.txt"), "haystack\n"))
      yield* withTools(tmp.path, (registry) =>
        Effect.gen(function* () {
          expect(yield* executeTool(registry, call("grep", { pattern: "needle", outputMode: "files" }))).toMatchObject({
            status: "completed",
            output: [],
            content: [{ type: "text", text: "No matches found" }],
            metadata: { files: 0, truncated: false },
          })
          for (const input of [
            { pattern: "[" },
            { pattern: "" },
            { pattern: "needle", path: "missing" },
            { pattern: "needle", outputMode: "invalid" },
            { pattern: "needle", limit: 0 },
          ]) {
            const result = yield* executeTool(registry, call("grep", { outputMode: "files", ...input }))
            expect(result.status).toBe("error")
          }
        }),
      )
    }),
  )

  it.live("grep file output authorizes external files before searching", () =>
    Effect.gen(function* () {
      const active = yield* tmpdirScoped()
      const outside = yield* tmpdirScoped()
      const assertions: Permission.AssertInput[] = []
      yield* Effect.promise(() => Bun.write(path.join(outside.path, "file.txt"), "needle\n"))
      yield* withTools(
        active.path,
        (registry) =>
          Effect.gen(function* () {
            const result = yield* executeTool(
              registry,
              call("grep", { pattern: "needle", path: path.join(outside.path, "file.txt"), outputMode: "files" }),
            )
            expect(result.status).toBe("completed")
            expect(assertions.map((input) => input.action)).toEqual(["external_directory", "grep"])
            expect(assertions[1]?.metadata).toMatchObject({ outputMode: "files" })
          }),
        assertions,
      )
    }),
  )

  for (const hidden of [undefined, false, true]) {
    for (const limit of hidden ? [10] : [1, 10]) {
      it.live(`glob honors hidden=${hidden} before limit=${limit}`, () =>
        Effect.gen(function* () {
          const tmp = yield* tmpdirScoped()
          yield* Effect.promise(() =>
            Promise.all(
              ["src/visible.ts", ".hidden.ts", "src/.hidden.ts", ".hidden/nested.ts", ".git/config.ts"].map((file) =>
                Bun.write(path.join(tmp.path, file), "needle\n"),
              ),
            ),
          )
          yield* withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const result = yield* executeTool(
                registry,
                call("glob", { pattern: "**/*.ts", limit, ...(hidden === undefined ? {} : { hidden }) }),
              )
              const expected = hidden
                ? [".hidden.ts", ".hidden/nested.ts", "src/.hidden.ts", "src/visible.ts"]
                : ["src/visible.ts"]

              expect(result.status).toBe("completed")
              expect(result.output).toHaveLength(expected.length)
              expect(result.output).toEqual(
                expect.arrayContaining(expected.map((file) => ({ path: path.normalize(file), type: "file" }))),
              )
              expect(result.metadata).toEqual({ count: expected.length, truncated: false })
              expect(result.content).toHaveLength(1)
              expect(result.content?.[0]?.type === "text" ? result.content[0].text.split("\n").sort() : []).toEqual(
                expected.map((file) => path.join(tmp.path, file)).sort(),
              )
            }),
          )
        }),
      )
    }
  }

  it.live("bounds omitted glob and grep limits", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all(
              Array.from({ length: FileSystem.DEFAULT_SEARCH_LIMIT + 1 }, (_, index) =>
                fs.writeFile(path.join(tmp.path, `${index}.txt`), "needle\n"),
              ),
            ),
          )
          yield* withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const glob = yield* executeTool(registry, call("glob", { pattern: "*" }))
              const grep = yield* executeTool(registry, call("grep", { pattern: "needle" }))

              expect(glob.metadata).toEqual({ count: FileSystem.DEFAULT_SEARCH_LIMIT, truncated: true })
              expect(grep.metadata).toEqual({ matches: FileSystem.DEFAULT_SEARCH_LIMIT, truncated: true })
              expect(glob.content).toHaveLength(1)
              expect(grep.content).toHaveLength(1)
              const globText = glob.content?.[0]?.type === "text" ? glob.content[0].text : ""
              const grepText = grep.content?.[0]?.type === "text" ? grep.content[0].text : ""
              expect(globText.split("\n")).toHaveLength(FileSystem.DEFAULT_SEARCH_LIMIT + 2)
              expect(globText).toEndWith(
                `(Results are truncated: showing first ${FileSystem.DEFAULT_SEARCH_LIMIT} results. Consider using a more specific path or pattern.)`,
              )
              expect(grepText).toStartWith(`Found ${FileSystem.DEFAULT_SEARCH_LIMIT} matches\n`)
              expect(grepText).toEndWith(
                `(Results are truncated: showing first ${FileSystem.DEFAULT_SEARCH_LIMIT} results. Consider using a more specific path or pattern.)`,
              )
            }),
          )
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("rejects an empty grep pattern", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect(yield* executeTool(registry, call("grep", { pattern: "" }))).toEqual({
              status: "error",
              error: {
                type: "tool.execution",
                message:
                  'Invalid arguments for tool "grep":\n- pattern: Pattern must not be empty\n\nArguments provided:\n{\n  "pattern": ""\n}\n\nUpdate the arguments and call the tool again.',
              },
            })
          }),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("handles explicit grep file and directory paths", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() =>
          Promise.all([
            fs.writeFile(path.join(tmp.path, "target.txt"), "needle\n"),
            fs.writeFile(path.join(tmp.path, "other.txt"), "needle\n"),
          ]),
        ).pipe(
          Effect.andThen(
            withTools(tmp.path, (registry) =>
              Effect.gen(function* () {
                const file = yield* executeTool(registry, call("grep", { path: "target.txt", pattern: "needle" }))
                expect(file).toMatchObject({
                  status: "completed",
                  output: [{ entry: { path: "target.txt" }, line: 1, text: "needle\n" }],
                  metadata: { matches: 1, truncated: false },
                })

                const directory = yield* executeTool(registry, call("grep", { path: ".", pattern: "needle" }))
                expect(directory).toMatchObject({
                  status: "completed",
                  metadata: { matches: 2, truncated: false },
                })
                if (directory.status !== "completed") return
                expect(directory.output).toEqual(
                  expect.arrayContaining([
                    expect.objectContaining({ entry: expect.objectContaining({ path: "target.txt" }) }),
                    expect.objectContaining({ entry: expect.objectContaining({ path: "other.txt" }) }),
                  ]),
                )
              }),
            ),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("reports no grep matches", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() => fs.writeFile(path.join(tmp.path, "file.txt"), "haystack\n")).pipe(
          Effect.andThen(withTools(tmp.path, (registry) => executeTool(registry, call("grep", { pattern: "needle" })))),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result).toMatchObject({
                status: "completed",
                content: [{ type: "text", text: "No matches found" }],
                metadata: { matches: 0, truncated: false },
              })
            }),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("reports invalid grep regex details", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            const result = yield* executeTool(registry, call("grep", { pattern: "[" }))
            expect(result).toMatchObject({
              status: "error",
              error: { type: "tool.execution" },
            })
            if (result.status !== "error" || !result.error) return
            expect(result.error.message).toStartWith("Invalid regex pattern:")
            expect(result.error.message).toContain("unclosed character class")
          }),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires external_directory approval for external grep files and directories", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(() => fs.writeFile(path.join(outside.path, "outside.txt"), "needle\n")).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) =>
                Effect.gen(function* () {
                  const directory = yield* executeTool(
                    registry,
                    call("grep", { path: outside.path, pattern: "needle" }),
                  )
                  const file = yield* executeTool(
                    registry,
                    call("grep", { path: path.join(outside.path, "outside.txt"), pattern: "needle" }),
                  )
                  expect(directory.status).toBe("completed")
                  expect(file.status).toBe("completed")
                }),
              assertions,
            ),
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              expect(assertions.map((input) => input.action)).toEqual([
                "external_directory",
                "grep",
                "external_directory",
                "grep",
              ])
              expect(assertions[0]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
              expect(assertions[2]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  for (const name of ["glob", "grep"] as const) {
    it.live(`${name} reports a missing search path`, () =>
      Effect.acquireUseRelease(
        Effect.promise(() => tmpdir()),
        (tmp) =>
          withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const result = yield* executeTool(
                registry,
                call(name, { path: "missing", pattern: name === "glob" ? "*" : "needle" }),
              )
              expect(result).toEqual({
                status: "error",
                error: { type: "tool.execution", message: "Search path does not exist: missing" },
              })
            }),
          ),
        (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
      ),
    )
  }

  it.live("reports a file used as the glob search path", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() => fs.writeFile(path.join(tmp.path, "file.txt"), "content\n")).pipe(
          Effect.andThen(
            withTools(tmp.path, (registry) => executeTool(registry, call("glob", { path: "file.txt", pattern: "*" }))),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result).toEqual({
                status: "error",
                error: { type: "tool.execution", message: "Search path is not a directory: file.txt" },
              })
            }),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires external_directory approval for an explicit external glob path", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(() => fs.writeFile(path.join(outside.path, "outside.txt"), "outside\n")).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) => executeTool(registry, call("glob", { path: outside.path, pattern: "*.txt" })),
              assertions,
            ),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result.status).toBe("completed")
              expect(assertions.map((input) => input.action)).toEqual(["external_directory", "glob"])
              expect(assertions[0]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  it.live("globs through an in-location external symlink without external approval", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        if (process.platform === "win32") return Effect.void
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(async () => {
          await fs.writeFile(path.join(outside.path, "outside.txt"), "outside\n")
          await fs.symlink(outside.path, path.join(active.path, "linked"))
        }).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) => executeTool(registry, call("glob", { path: "linked", pattern: "*.txt" })),
              assertions,
            ),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result.status).toBe("completed")
              expect(assertions.map((input) => input.action)).toEqual(["glob"])
              expect(result).toMatchObject({
                output: [{ path: path.join("linked", "outside.txt"), type: "file" }],
                content: [{ type: "text", text: path.join(active.path, "linked", "outside.txt") }],
              })
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )
})
