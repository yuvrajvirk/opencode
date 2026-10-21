export * as BlackFormatter from "./black.js"

import path from "path"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/process"
import type { FSUtil } from "@opencode/util/fs-util"
import type { AppProcess } from "@opencode/util/process"
import { parse } from "smol-toml"
import { load } from "js-yaml"
import { which } from "../util/which.js"

const Table = Schema.Record(Schema.String, Schema.Unknown)
const Project = Schema.Struct({
  tool: Schema.optionalKey(
    Schema.Struct({
      black: Schema.optionalKey(Table),
      ruff: Schema.optionalKey(Schema.Struct({ format: Schema.optionalKey(Table) })),
    }),
  ),
})
const Hook = Schema.Struct({
  id: Schema.String,
  args: Schema.optionalKey(Schema.Array(Schema.String)),
  files: Schema.optionalKey(Schema.String),
  exclude: Schema.optionalKey(Schema.String),
  entry: Schema.optionalKey(Schema.String),
  language: Schema.optionalKey(Schema.String),
  types: Schema.optionalKey(Schema.Array(Schema.String)),
  types_or: Schema.optionalKey(Schema.Array(Schema.String)),
  exclude_types: Schema.optionalKey(Schema.Array(Schema.String)),
  pass_filenames: Schema.optionalKey(Schema.Boolean),
})
const Hooks = Schema.Struct({
  files: Schema.optionalKey(Schema.String),
  exclude: Schema.optionalKey(Schema.String),
  repos: Schema.Array(Schema.Struct({ repo: Schema.String, hooks: Schema.Array(Hook) })),
})
const sources = new Set([
  "https://github.com/psf/black",
  "https://github.com/ambv/black",
  "https://github.com/psf/black-pre-commit-mirror",
])
const flags = new Set([
  "--safe",
  "--fast",
  "--quiet",
  "--preview",
  "--skip-string-normalization",
  "--skip-magic-trailing-comma",
  "-S",
  "-C",
])
const types = new Set(["file", "text", "python", "pyi"])
const match = `import json, re, sys
if sys.version_info[0] != 3:
    sys.exit(2)
data = json.load(sys.stdin)
included = all(
    (entry.get("files") is None or re.search(entry["files"], data["path"]) is not None)
    and (entry.get("exclude") is None or re.search(entry["exclude"], data["path"]) is None)
    for entry in data["filters"]
)
sys.stdout.write("1" if included else "0")
`

export const command = Effect.fn("BlackFormatter.command")(
  function* (input: {
    filepath: string
    directory: string
    worktree: string
    fs: FSUtil.Interface
    processes: AppProcess.Interface
    bin: string
  }) {
    const configs = yield* input.fs.findUp(".pre-commit-config.yaml", input.directory, input.worktree)
    if (configs.length) {
      const text = yield* input.fs.readFileString(configs[0])
      const config = yield* Effect.try(() => Schema.decodeUnknownSync(Hooks)(load(text, { json: true })))
      const hooks = config.repos.flatMap((repo) =>
        repo.hooks
          .filter((hook) => hook.id === "black" || hook.id === "ruff-format")
          .map((hook) => ({ repo: repo.repo, ...hook })),
      )
      if (hooks.length) {
        if (hooks.length !== 1) return false
        const hook = hooks[0]
        if (hook.id !== "black" || !sources.has(hook.repo)) return false
        if (hook.entry !== undefined && hook.entry !== "black") return false
        if (hook.language !== undefined && hook.language !== "python" && hook.language !== "system") return false
        if (hook.pass_filenames === false) return false
        if (
          [...(hook.types ?? []), ...(hook.types_or ?? []), ...(hook.exclude_types ?? [])].some(
            (type) => !types.has(type),
          )
        )
          return false
        const args = [...(hook.args ?? [])]
        for (let index = 0; index < args.length; index++) {
          const argument = args[index]
          if (flags.has(argument)) continue
          if (/^--line-length=\d+$/.test(argument) || /^--target-version=py\d+$/.test(argument)) continue
          if (argument === "--line-length" || argument === "-l") {
            if (!/^\d+$/.test(args[++index] ?? "")) return false
            continue
          }
          if (argument === "--target-version" || argument === "-t") {
            if (!/^py\d+$/.test(args[++index] ?? "")) return false
            continue
          }
          return false
        }
        const relative = path.relative(input.worktree, input.filepath).split(path.sep).join("/")
        const filters = [config, hook]
          .map((filter) => ({ files: filter.files, exclude: filter.exclude }))
          .filter((filter) => filter.files !== undefined || filter.exclude !== undefined)
        if (filters.length) {
          const executable = yield* input.fs.realPath(input.bin).pipe(Effect.orElseSucceed(() => input.bin))
          const names = ["python", "python3"]
          const candidates = path.isAbsolute(executable)
            ? [...names.map((name) => path.join(path.dirname(executable), name)), "python3", "python"]
            : ["python3", "python"]
          const python = candidates.map((name) => which(name)).find((executable) => executable !== null)
          if (!python) return "skip" as const
          const result = yield* input.processes
            .run(ChildProcess.make(python, ["-I", "-S", "-c", match], { cwd: input.directory, extendEnv: true }), {
              stdin: JSON.stringify({ path: relative, filters }),
              timeout: "2 seconds",
              maxOutputBytes: 64,
              maxErrorBytes: 1024,
            })
            .pipe(Effect.orElseSucceed(() => undefined))
          if (result?.exitCode !== 0 || result.stdout.toString("utf8") !== "1") return "skip" as const
        }
        const tags = new Set(["file", "text", path.extname(input.filepath) === ".pyi" ? "pyi" : "python"])
        if (
          hook.types?.some((type) => !tags.has(type)) ||
          (hook.types_or?.length && !hook.types_or.some((type) => tags.has(type))) ||
          hook.exclude_types?.some((type) => tags.has(type))
        )
          return "skip" as const
        return [input.bin, "--quiet", ...args, "$FILE"]
      }
    }
    for (const file of yield* input.fs.findUp("pyproject.toml", input.directory, input.worktree)) {
      const text = yield* input.fs.readFileString(file)
      const config = yield* Effect.try(() =>
        Schema.decodeUnknownSync(Project)(parse(text, { integersAsBigInt: "asNeeded" })),
      )
      if (config.tool?.ruff?.format !== undefined) return false
      if (config.tool?.black !== undefined) return [input.bin, "--quiet", "$FILE"]
    }
    return false
  },
  Effect.orElseSucceed(() => false as const),
)
