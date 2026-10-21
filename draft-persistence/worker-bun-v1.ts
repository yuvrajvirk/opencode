import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"

const [checkout, fixtureName = "development-fixtures.json"] = process.argv.slice(2)
if (!checkout) throw new Error("Usage: bun worker.ts checkout [fixture filename]")
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
const sourcePath = path.join(checkout, "packages/app/src/runtime/persistence/drafts.ts")
const { createDraftStore } = await import(sourcePath)
const fixtureBytes = await fs.readFile(path.join(import.meta.dir, fixtureName))
const fixture = JSON.parse(fixtureBytes.toString())
const profiles = ["append", "prepend", "middle", "delete", "replace"]
const safeOffset = (text: string, offset: number) => {
  const current = text.charCodeAt(offset)
  const previous = text.charCodeAt(offset - 1)
  return current >= 0xdc00 && current <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff ? offset + 1 : offset
}
const results = []
for (const snapshot of fixture.snapshots) {
  for (const file of snapshot.files) {
    assert.equal(hash(file.text), file.source_sha256, file.id)
    for (const profile of profiles) {
      const documents = new Map<string, string>()
      const blobs = new Map<string, Blob>()
      const counters = { document_bytes: 0, blob_bytes: 0, document_calls: 0, blob_calls: 0 }
      const driver = {
        get: async (key: string) => documents.get(key) ?? null,
        set: async (key: string, serialized: string, strict?: boolean) => {
          counters.document_bytes += Buffer.byteLength(serialized)
          counters.document_calls++
          const ids = new Set<string>()
          JSON.parse(serialized, (_key, value) => {
            if (value?.blob && typeof value.blob.id === "string") ids.add(value.blob.id)
            if (value?.blob && Array.isArray(value.blob.ids)) for (const id of value.blob.ids) ids.add(id)
            return value
          })
          const missing = [...ids].filter((id) => !blobs.has(id))
          if (!strict || missing.length === 0) documents.set(key, serialized)
          return missing
        },
        remove: async (key: string) => void documents.delete(key),
        putBlob: async (blob: Blob) => {
          counters.blob_bytes += blob.size
          counters.blob_calls++
          const id = hash(new Uint8Array(await blob.arrayBuffer()))
          blobs.set(id, blob)
          return id
        },
        getBlob: async (id: string) => blobs.get(id) ?? null,
      }
      const store = createDraftStore(driver)
      const stages = []
      let text = file.text
      let cursor = safeOffset(text, profile === "append" ? text.length : profile === "prepend" ? 0 : Math.floor(text.length / 2))
      const persist = async (phase: string, step: number) => {
        const expected = { prompt: [{ type: "text", content: text }] }
        const before = { ...counters }
        const started = performance.now()
        if (typeof store.setDocument === "function") await store.setDocument("draft", expected)
        else await store.setItem("draft", JSON.stringify(expected))
        const elapsed = performance.now() - started
        const restored = await createDraftStore(driver).getItem("draft")
        assert.notEqual(restored, null, "Missing restored document")
        assert.deepEqual(JSON.parse(restored!), expected)
        stages.push({
          phase, step, elapsed_ms: elapsed, exact: true,
          expected_sha256: hash(JSON.stringify(expected)),
          ...Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, value - before[key]])),
        })
      }
      try {
        await persist("initial", 0)
        for (let step = 1; step <= 10; step++) {
          const insert = String(step).padStart(5, "0")
          if (profile === "delete") {
            const end = safeOffset(text, Math.min(text.length, cursor + 5))
            text = text.slice(0, cursor) + text.slice(end)
          } else if (profile === "replace") {
            const end = safeOffset(text, Math.min(text.length, cursor + 10))
            text = text.slice(0, cursor) + "edit-" + insert + text.slice(end)
          } else {
            text = text.slice(0, cursor) + insert + text.slice(cursor)
            cursor += insert.length
          }
          await persist("edit", step)
        }
        text = file.text
        await persist("undo", 11)
        results.push({
          id: file.id, repo: snapshot.repo, path: file.path, band: file.band, profile, stages,
          retained_unique_blob_bytes: [...blobs.values()].reduce((total, blob) => total + blob.size, 0),
          retained_document_bytes: [...documents.values()].reduce((total, text) => total + Buffer.byteLength(text), 0),
        })
      } catch (error) {
        results.push({ id: file.id, repo: snapshot.repo, path: file.path, band: file.band, profile, stages, error: String(error) })
      }
    }
  }
  console.error(`${snapshot.repo}@${snapshot.revision.slice(0, 8)}: ${snapshot.files.length} files`)
}
console.log(JSON.stringify({
  checkout, runtime: `Bun ${Bun.version}`,
  revision: Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: checkout }).stdout.toString().trim(),
  source_sha256: hash(await fs.readFile(sourcePath)),
  lock_sha256: hash(await fs.readFile(path.join(checkout, "bun.lock"))),
  worker_sha256: hash(await fs.readFile(import.meta.path)), fixture_sha256: hash(fixtureBytes),
  protocol_sha256: fixture.protocol_sha256, profiles, results,
}))
