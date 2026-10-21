import fs from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"

const root = new URL(".", import.meta.url).pathname
const hash = (text) => createHash("sha256").update(text).digest("hex")
const lines = []
let length = 0
for (let index = 0; length < 8 * 1024 * 1024; index++) {
  const line = `${index.toString().padStart(8, "0")}: ${"abcdefghijklmnopqrstuvwxyz".repeat(1 + (index * 31) % 7)}\n`
  lines.push(line)
  length += line.length
}
const content = lines.join("")
const textCases = []
for (const size of [512 * 1024, 1024 * 1024, 2 * 1024 * 1024, 3 * 1024 * 1024, 4 * 1024 * 1024 - 1024, 4 * 1024 * 1024, 8 * 1024 * 1024]) {
  textCases.push([`lines-${size}`, content.slice(0, size)])
  textCases.push([`no-newlines-${size}`, content.slice(0, size).replaceAll("\n", " ")])
}
for (const position of [0, 32767, 32768, 65535, 65536, 131072]) {
  textCases.push([`unicode-boundary-${position}`, content.slice(0, position) + "\uFEFF😀\uFEFF" + content.slice(position, 196608)])
}
const fixture = {
  protocol_sha256: hash(fs.readFileSync(path.join(root, "protocol.md"))),
  scope: "Post-prototype synthetic falsification probes; not independent content corpus or held-out gains",
  snapshots: [{
    repo: "synthetic-diagnostics", revision: "declared-size-and-unicode-boundaries", split: "diagnostic",
    files: textCases.map(([name, text]) => ({ id: hash(name), path: name, band: "diagnostic", text, source_sha256: hash(text), bytes: Buffer.byteLength(text) })),
  }],
}
fs.writeFileSync(path.join(root, "diagnostic-fixtures.json"), JSON.stringify(fixture) + "\n", { flag: "wx" })
console.log(JSON.stringify({ cases: textCases.length, source_bytes: textCases.reduce((total, [, text]) => total + Buffer.byteLength(text), 0) }))
