import path from "node:path"
import { createHash } from "node:crypto"

const protocol = await Bun.file(path.join(import.meta.dir, "holdout-protocol.json")).json()
const fixtures = []
const sources = []
for (const page of protocol.pages) {
  const file = `${protocol.root}/${page}/index.md`
  const url = `https://raw.githubusercontent.com/mdn/content/${protocol.revision}/${file}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const text = await response.text()
  await Bun.write(path.join(import.meta.dir, "holdout-source", `${page}.md`), text)
  sources.push({ page, url, sha256: createHash("sha256").update(text).digest("hex") })
  const lines = text.split("\n")
  let fence: { marker: string; start: number; selected: boolean; code: Array<string> } | undefined
  let ordinal = 0
  for (const [position, line] of lines.entries()) {
    if (fence) {
      if (new RegExp(`^\\s*${fence.marker[0]}{${fence.marker.length},}\\s*$`).test(line)) {
        if (fence.selected) {
          const code = fence.code.join("\n")
          fixtures.push({ id: `${page}/${++ordinal}`, page, url, line: fence.start, code, sha256: createHash("sha256").update(code).digest("hex") })
        }
        fence = undefined
      } else fence.code.push(line)
      continue
    }
    const opening = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
    if (opening) fence = { marker: opening[1], start: position + 2, selected: /^(js|javascript)(?:\s|$)/i.test(opening[2].trim()), code: [] }
  }
  if (fence) throw new Error(`Unclosed fence in ${file}`)
}
await Bun.write(path.join(import.meta.dir, "holdout-sources.json"), JSON.stringify({ revision: protocol.revision, sources }, null, 2) + "\n")
await Bun.write(path.join(import.meta.dir, "holdout-fixtures.json"), JSON.stringify(fixtures, null, 2) + "\n")
console.log(JSON.stringify({ pages: sources.length, fixtures: fixtures.length }))
