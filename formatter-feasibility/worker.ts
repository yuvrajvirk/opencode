import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const [root, selection = "all", fixturePath] = process.argv.slice(2)
if (!root) throw new Error("Usage: bun worker.ts checkout [repository|all] [fixtures.json]")
const evidence = new URL(".", import.meta.url).pathname
const fixtureText = await Bun.file(fixturePath ?? path.join(evidence, "development-fixtures.json")).text()
const fixture = JSON.parse(fixtureText)
const selected = fixture.snapshots.filter((record) => selection === "all" || record.repo === selection)
if (!selected.length) throw new Error(`Unknown repository: ${selection}`)
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-formatter-worker-"))
const executable = process.execPath
const git = Bun.which("git")
if (!git) throw new Error("Git is required")
for (const key of Object.keys(process.env)) delete process.env[key]
Object.assign(process.env, {
  HOME: path.join(temporary, "home"),
  XDG_DATA_HOME: path.join(temporary, "data"),
  XDG_CACHE_HOME: path.join(temporary, "cache"),
  XDG_CONFIG_HOME: path.join(temporary, "config"),
  XDG_STATE_HOME: path.join(temporary, "state"),
  PATH: path.join(temporary, "bin"),
  TMPDIR: path.join(temporary, "tmp"),
  LANG: "C.UTF-8",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  BLACK_CACHE_DIR: path.join(temporary, "black-cache"),
  OPENCODE_TEST_HOME: path.join(temporary, "home"),
  OPENCODE_TEST_MANAGED_CONFIG_DIR: path.join(temporary, "managed"),
  OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
  OPENCODE_DISABLE_MODELS_FETCH: "true",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
})
await Promise.all(["home", "bin", "tmp", "config/opencode"].map((name) => fs.mkdir(path.join(temporary, name), { recursive: true })))
await Promise.all([
  fs.symlink(executable, path.join(temporary, "bin/bun")),
  fs.symlink(git, path.join(temporary, "bin/git")),
  fs.symlink(path.join(evidence, ".venv/bin/black"), path.join(temporary, "bin/black")),
  fs.symlink(path.join(evidence, ".venv/bin/ruff"), path.join(temporary, "bin/ruff")),
])
const historical = await Bun.file(path.join(root, "packages/opencode/src/format/index.ts")).exists()
const packagePath = historical ? "packages/opencode" : "packages/core"
const require = createRequire(path.join(root, packagePath, "package.json"))
const { Effect, Layer } = await import(require.resolve("effect"))
const module = (filename: string) => import(path.join(root, filename))
let run
let dispose = async () => {}
if (historical) {
  const { Format } = await module("packages/opencode/src/format/index.ts")
  const { Bus } = await module("packages/opencode/src/bus/index.ts")
  const { File } = await module("packages/opencode/src/file/index.ts")
  const { Instance } = await module("packages/opencode/src/project/instance.ts")
  const { withServices } = await module("packages/opencode/test/fixture/instance.ts")
  const { Log } = await module("packages/opencode/src/util/log.ts")
  await Log.init({ print: false, dev: true, level: "ERROR" })
  await fs.chmod(path.join(temporary, "config/opencode"), 0o555)
  run = async (directory, files, report) => {
    await withServices(directory, Format.layer, async (runtime) => {
      await runtime.runPromise(Format.Service.use((service) => service.init()))
      for (const file of files) {
        if (file.fixture_error) continue
        const filepath = path.join(directory, file.path)
        await Bus.publish(File.Event.Edited, { file: filepath })
        await report(file, undefined)
      }
    })
  }
  dispose = async () => {
    await Instance.disposeAll()
    const { Database } = await module("packages/opencode/src/storage/db.ts")
    Database.close()
  }
} else {
  const { AppNodeBuilder } = await module("packages/core/src/effect/app-node-builder.ts")
  const { LayerNode } = await module("packages/util/src/effect/layer-node.ts")
  const { Global } = await module("packages/util/src/global.ts")
  const { Database } = await module("packages/core/src/database/database.ts")
  const { Bus } = await module("packages/core/src/bus.ts")
  const { SdkPlugins } = await module("packages/core/src/plugin/sdk.ts")
  const { LocationServiceMap } = await module("packages/core/src/location-services.ts")
  const { Location } = await module("packages/core/src/location.ts")
  const { AbsolutePath } = await module("packages/core/src/schema.ts")
  const { Plugin } = await module("packages/core/src/plugin.ts")
  const { Formatter } = await module("packages/core/src/formatter.ts")
  const { tempGlobalLayer } = await module("packages/core/test/fixture/global.ts")
  const { offlineModels } = await module("packages/core/test/fixture/models.ts")
  const layers = AppNodeBuilder.build(
    LayerNode.group([Database.node, Bus.node, SdkPlugins.node, LocationServiceMap.node, Global.node]),
    [Global.node.replace(tempGlobalLayer), offlineModels],
  )
  run = async (directory, files, report) => {
    const active = LocationServiceMap.Service.get(Location.Ref.make({ directory: AbsolutePath.make(directory) }))
    await Effect.runPromise(
      Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const formatter = yield* Formatter.Service
        for (const file of files) {
          if (file.fixture_error) continue
          const formatted = yield* formatter.file(path.join(directory, file.path))
          yield* Effect.promise(() => report(file, formatted))
        }
      }).pipe(Effect.provide(active), Effect.provide(layers), Effect.scoped),
    )
  }
}
const results = []
try {
  for (const record of selected) {
    const directory = path.join(temporary, "repositories", record.revision)
    await fs.mkdir(directory, { recursive: true })
    const initialized = Bun.spawnSync([git, "-c", "init.templateDir=", "init", "-q", directory], { env: process.env })
    if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
    for (const config of record.configs) await Bun.write(path.join(directory, config.path), config.text)
    await Bun.write(path.join(directory, "opencode.json"), JSON.stringify({ formatter: historical ? {} : true }))
    for (const file of record.files) {
      if (!file.fixture_error) {
        await Bun.write(path.join(directory, file.path), file.input)
        if (file.source_mode !== undefined) await fs.chmod(path.join(directory, file.path), file.source_mode)
      }
    }
    const outcomes = []
    const report = async (file, formatted) => {
      const actual = Buffer.from(await Bun.file(path.join(directory, file.path)).arrayBuffer()).toString("utf8")
      outcomes.push({
        id: file.id,
        path: file.path,
        formatted,
        actual_sha256: createHash("sha256").update(actual).digest("hex"),
        correct: typeof file.expected === "string" ? actual === file.expected : undefined,
        changed_input: actual !== file.input,
      })
    }
    try {
      await run(directory, record.files, report)
      results.push({ repo: record.repo, revision: record.revision, outcomes })
    } catch (error) {
      results.push({ repo: record.repo, revision: record.revision, outcomes, error: String(error) })
    }
    console.error(`${record.repo}@${record.revision.slice(0, 8)}: ${outcomes.length} outcomes`)
  }
} finally {
  await dispose()
  await fs.chmod(path.join(temporary, "config/opencode"), 0o755)
  await fs.rm(temporary, { recursive: true, force: true })
}
const source = historical ? "packages/opencode/src/format/formatter.ts" : "packages/core/src/formatter/builtins.ts"
const sourceFiles = historical
  ? [source, "packages/opencode/src/format/index.ts"]
  : [source, "packages/core/src/formatter.ts", "packages/core/src/config/plugin/formatter.ts", "packages/core/src/formatter/black.ts"]
const hashes = {}
for (const filename of [...sourceFiles, "bun.lock"]) {
  const file = Bun.file(path.join(root, filename))
  if (await file.exists()) hashes[filename] = createHash("sha256").update(await file.text()).digest("hex")
}
console.log(JSON.stringify({
  root,
  historical,
  revision: Bun.spawnSync([git, "rev-parse", "HEAD"], { cwd: root }).stdout.toString().trim(),
  source_sha256: createHash("sha256").update(await Bun.file(path.join(root, source)).text()).digest("hex"),
  source_files: hashes,
  runner_sha256: createHash("sha256").update(await Bun.file(import.meta.path).text()).digest("hex"),
  runtime: `Bun ${Bun.version}`,
  fixture_sha256: createHash("sha256").update(fixtureText).digest("hex"),
  results,
}))
