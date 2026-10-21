import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createHash } from "node:crypto"

const root = new URL(".", import.meta.url).pathname
const source = process.argv[2] ?? "/home/yvirk2/opencode-research/test262"
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")))
const results = []
for (const record of manifest.records.filter((entry) => !entry.excluded)) {
  const text = fs.readFileSync(path.join(root, "fixtures", record.file), "utf8")
  if (createHash("sha256").update(text).digest("hex") !== record.sha256) throw new Error(`Changed fixture: ${record.file}`)
  const includes = [...new Set(["sta.js", "assert.js", ...record.includes])]
  const support = includes.map((name) => fs.readFileSync(path.join(source, "harness", name), "utf8")).join("\n")
  try {
    vm.runInNewContext(`"use strict";\n${support}\n${text}`, {}, { timeout: 5000 })
    results.push({ file: record.file, status: "pass" })
  } catch (error) {
    results.push({ file: record.file, status: "fail", reason: String(error) })
  }
}
const summary = { runtime: process.version, fixture_sha256: manifest.fixture_sha256, pass: results.filter((entry) => entry.status === "pass").length, total: results.length }
fs.writeFileSync(path.join(root, "native.json"), JSON.stringify({ ...summary, results }, null, 2) + "\n")
console.log(JSON.stringify(summary))
