import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

const root = new URL(".", import.meta.url).pathname
const output = path.join(root, process.argv[2] ?? "cost-weighted")
await fs.mkdir(output)
const checkouts = {
  latest: path.join(root, "checkouts/latest"),
  candidate: "/home/yvirk2/opencode-worktrees/draft-chunks",
}
for (const engine of ["bun", "node"]) {
  for (let round = 0; round <= 5; round++) {
    for (const label of round % 2 === 0 ? ["latest", "candidate"] : ["candidate", "latest"]) {
      const name = `${engine}-${round === 0 ? "warmup" : round}-${label}`
      console.log(name)
      const stdout = await fs.open(path.join(output, `${name}.json`), "wx")
      const stderr = await fs.open(path.join(output, `${name}.stderr`), "wx")
      try {
        const args = ["-v", "-o", path.join(output, `${name}.time`), engine,
          ...(engine === "node" ? ["--experimental-strip-types"] : []),
          path.join(root, "worker.ts"), checkouts[label]]
        const status = await new Promise((resolve, reject) => {
          const child = spawn("/usr/bin/time", args, { cwd: root, stdio: ["ignore", stdout.fd, stderr.fd] })
          child.on("error", reject)
          child.on("close", resolve)
        })
        if (status !== 0) throw new Error(`${name} exited ${status}; retained logs in ${output}`)
      } finally {
        await stdout.close()
        await stderr.close()
      }
    }
  }
}
