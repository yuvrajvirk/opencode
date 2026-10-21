import fs from "fs/promises"
import path from "path"
import { expect } from "bun:test"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { BlackFormatter } from "@opencode/core/formatter/black"
import { FSUtil } from "@opencode/util/fs-util"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { withTempDir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([FSUtil.node, AppProcess.node])))
const python = Bun.which("python3") ?? Bun.which("python")
const command = ["black", "--quiet", "$FILE"]
const hook = (input: Record<string, unknown> = {}, root: Record<string, unknown> = {}) =>
  JSON.stringify({
    ...root,
    repos: [{ repo: "https://github.com/psf/black", hooks: [{ id: "black", ...input }] }],
  })

const cases: {
  name: string
  files: Record<string, string>
  target?: string
  directory?: string
  expected: false | "skip" | string[]
  python?: boolean
}[] = [
  { name: "does not infer formatting without a declaration", files: {}, expected: false },
  {
    name: "recognizes a Black table",
    files: { "pyproject.toml": "[tool.black]\nline-length = 90\n" },
    expected: command,
  },
  {
    name: "recognizes quoted TOML keys",
    files: { "pyproject.toml": '["tool"."black"]\nline-length = 90\n' },
    expected: command,
  },
  {
    name: "does not interpret a TOML string as a table",
    files: { "pyproject.toml": '[project]\ndescription = """\n[tool.black]\nexample\n"""\n' },
    expected: false,
  },
  {
    name: "does not interpret isort compatibility as Black selection",
    files: { "pyproject.toml": '[tool.isort]\nprofile = "black"\n' },
    expected: false,
  },
  {
    name: "does not reject unrelated large TOML integers",
    files: { "pyproject.toml": "seed = 9007199254740999\n[tool.black]\n" },
    expected: command,
  },
  {
    name: "distinguishes Ruff lint configuration from formatting",
    files: { "pyproject.toml": '[tool.black]\n[tool.ruff.lint]\nselect = ["E"]\n' },
    expected: command,
  },
  {
    name: "defers to explicit Ruff formatting",
    files: { "pyproject.toml": '[tool.black]\n[tool.ruff]\nformat.quote-style = "single"\n' },
    expected: false,
  },
  { name: "recognizes an official hook", files: { ".pre-commit-config.yaml": hook() }, expected: command },
  {
    name: "uses the last duplicate mapping key as PyYAML does",
    files: {
      ".pre-commit-config.yaml":
        "repos: []\nrepos:\n  - repo: https://github.com/psf/black\n    hooks: [{id: black}]\n",
    },
    expected: command,
  },
  {
    name: "accepts unindented flow sequence contents as PyYAML does",
    files: {
      ".pre-commit-config.yaml":
        'repos:\n  - repo: https://github.com/psf/black\n    hooks:\n      - id: black\n        additional_dependencies: [\n        "unrelated-package",\n        ]\n',
    },
    expected: command,
  },
  {
    name: "preserves supported formatting options",
    files: {
      ".pre-commit-config.yaml": hook({ args: ["--safe", "--line-length", "120", "--target-version=py38", "-C"] }),
    },
    expected: ["black", "--quiet", "--safe", "--line-length", "120", "--target-version=py38", "-C", "$FILE"],
  },
  {
    name: "reads aliased hook objects as structured data",
    files: {
      ".pre-commit-config.yaml":
        "formatter: &formatter {id: black}\nrepos:\n  - repo: https://github.com/psf/black\n    hooks: [*formatter]\n",
    },
    expected: command,
  },
  {
    name: "does not interpret a YAML scalar as a hook",
    files: {
      ".pre-commit-config.yaml":
        "notes: |\n  - repo: https://github.com/psf/black\n    hooks:\n      - id: black\nrepos: []\n",
    },
    expected: false,
  },
  {
    name: "honors a hook inclusion filter",
    python: true,
    files: { ".pre-commit-config.yaml": hook({ files: "^src/" }) },
    target: "docs/example.py",
    expected: "skip",
  },
  {
    name: "honors root-level exclusions",
    python: true,
    files: { ".pre-commit-config.yaml": hook({}, { files: "^src/", exclude: "^src/generated/" }) },
    target: "src/generated/example.py",
    expected: "skip",
  },
  {
    name: "allows files matching both levels of filters",
    python: true,
    files: { ".pre-commit-config.yaml": hook({ files: "example\\.py$" }, { files: "^src/" }) },
    target: "src/example.py",
    expected: command,
  },
  {
    name: "honors supported file type restrictions",
    files: { ".pre-commit-config.yaml": hook({ types: ["python"] }) },
    target: "example.pyi",
    expected: "skip",
  },
  {
    name: "matches filters against the repository path from a nested configuration",
    python: true,
    files: { "nested/.pre-commit-config.yaml": hook({ files: "^nested/" }) },
    directory: "nested",
    target: "nested/example.py",
    expected: command,
  },
  {
    name: "accepts stub files through types_or",
    files: { ".pre-commit-config.yaml": hook({ types_or: ["python", "pyi"] }) },
    target: "example.pyi",
    expected: command,
  },
  {
    name: "does not restrict files when types_or is empty",
    files: { ".pre-commit-config.yaml": hook({ types_or: [] }) },
    expected: command,
  },
  {
    name: "honors excluded file types",
    files: { ".pre-commit-config.yaml": hook({ exclude_types: ["python"] }) },
    expected: "skip",
  },
  {
    name: "does not guess unsupported file tags",
    files: { ".pre-commit-config.yaml": hook({ types: ["executable"] }) },
    expected: false,
  },
  {
    name: "does not execute a replacement hook entry",
    files: { ".pre-commit-config.yaml": hook({ entry: "custom-command" }) },
    expected: false,
  },
  {
    name: "does not execute hooks that ignore filenames",
    files: { ".pre-commit-config.yaml": hook({ pass_filenames: false }) },
    expected: false,
  },
  {
    name: "does not pass arbitrary arguments to Black",
    files: { ".pre-commit-config.yaml": hook({ args: ["--config", "/outside/project.toml"] }) },
    expected: false,
  },
  {
    name: "rejects a missing formatting option value",
    files: { ".pre-commit-config.yaml": hook({ args: ["--line-length"] }) },
    expected: false,
  },
  {
    name: "does not choose between competing formatting hooks",
    files: {
      ".pre-commit-config.yaml":
        'repos: [{repo: "https://github.com/psf/black", hooks: [{id: black}, {id: ruff-format}]}]',
    },
    expected: false,
  },
  {
    name: "does not treat a local custom hook as official Black",
    files: { ".pre-commit-config.yaml": "repos: [{repo: local, hooks: [{id: black}]}]" },
    expected: false,
  },
  { name: "rejects malformed TOML", files: { "pyproject.toml": "[tool.black" }, expected: false },
  { name: "rejects malformed YAML", files: { ".pre-commit-config.yaml": "repos: [" }, expected: false },
  {
    name: "supports Python verbose regular expressions",
    python: true,
    files: { ".pre-commit-config.yaml": hook({ files: "(?x)^src/" }) },
    target: "src/example.py",
    expected: command,
  },
  {
    name: "preserves Python anchors and Unicode character classes",
    python: true,
    files: { ".pre-commit-config.yaml": hook({ files: "\\Asrc/\\w+\\.py\\Z" }) },
    target: "src/蛇.py",
    expected: command,
  },
  {
    name: "does not import project modules when evaluating filters",
    python: true,
    files: {
      ".pre-commit-config.yaml": hook({ files: "\\.py$" }),
      "re.py": "raise RuntimeError('project code executed')\n",
    },
    expected: command,
  },
  {
    name: "does not fall through to another formatter when a declared filter is invalid",
    python: true,
    files: { ".pre-commit-config.yaml": hook({ files: "[" }) },
    expected: "skip",
  },
]

for (const entry of cases) {
  ;(entry.python && !python ? it.live.skip : it.live)(entry.name, () =>
    withTempDir((temporary) =>
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        const processes = yield* AppProcess.Service
        yield* Effect.promise(() =>
          Promise.all(
            Object.entries(entry.files).map(async ([name, content]) => {
              const filename = path.join(temporary.path, name)
              await fs.mkdir(path.dirname(filename), { recursive: true })
              await fs.writeFile(filename, content)
            }),
          ),
        )
        expect(
          yield* BlackFormatter.command({
            filepath: path.join(temporary.path, entry.target ?? "example.py"),
            directory: path.join(temporary.path, entry.directory ?? ""),
            worktree: temporary.path,
            fs: filesystem,
            processes,
            bin: "black",
          }),
        ).toEqual(entry.expected)
      }),
    ),
  )
}
