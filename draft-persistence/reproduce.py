import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import urllib.request


parser = argparse.ArgumentParser()
parser.add_argument("--candidate", required=True)
parser.add_argument("--output", type=pathlib.Path, required=True)
parser.add_argument("--archives", type=pathlib.Path)
parser.add_argument("--split", choices=["development", "heldout", "both"], default="development")
parser.add_argument("--candidate-repository", default="https://github.com/yuvrajvirk/opencode.git")
options = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
destination = options.output.resolve()
destination.mkdir(parents=True, exist_ok=False)
research = destination / "draft-persistence"
research.mkdir()
corpus = destination / "context-wave3"
corpus.mkdir()
archives = corpus / "archives"
archives.mkdir()
for name in ["protocol.md", "prepare.py", "worker.ts", "score.mjs", "compare.mjs"]:
    shutil.copy2(root / name, research / name)
for name in ["grep-corpus.json", "snapshot-manifest.json"]:
    shutil.copy2(root.parent / "context-wave3" / name, corpus / name)
splits = ["development", "heldout"] if options.split == "both" else [options.split]
selection = json.loads((corpus / "grep-corpus.json").read_text())
needed = {item["revision"] for item in selection["cases"] if item["split"] in splits}
manifest = json.loads((corpus / "snapshot-manifest.json").read_text())
for item in manifest:
    if item["revision"] not in needed:
        continue
    filename = item["revision"] + ".tar.gz"
    cached = options.archives / filename if options.archives else None
    target = archives / filename
    if cached and cached.is_file():
        shutil.copy2(cached, target)
    else:
        with urllib.request.urlopen(item["url"], timeout=120) as response, target.open("xb") as output:
            shutil.copyfileobj(response, output)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == item["sha256"], filename


def run(arguments, cwd, log):
    print("Running", arguments[0], "in", cwd, flush=True)
    with log.open("ab") as output:
        subprocess.run(arguments, cwd=cwd, stdout=output, stderr=subprocess.STDOUT, check=True)


for split in splits:
    run(["python3", "prepare.py", "--split", split], research, research / f"prepare-{split}.log")
source = destination / "source"
run(["git", "init", str(source)], destination, destination / "git.log")
versions = {
    "before": ("44513bd0b002edc79f5bd2a3f6b0d02d9d727744", "https://github.com/anomalyco/opencode.git"),
    "original": ("798b2b359a781d141808591ef53e9ac6a5cfbba4", "https://github.com/anomalyco/opencode.git"),
    "latest": ("863ea413649484b5761cd0c5c0e54c559a5c8b52", "https://github.com/anomalyco/opencode.git"),
    "candidate": (options.candidate, options.candidate_repository),
}
assert subprocess.check_output(["bun", "--version"], text=True).strip() == "1.4.2"
for label, (revision, repository) in versions.items():
    run(["git", "fetch", "--depth=2", "--no-tags", repository, revision], source, destination / "git.log")
    checkout = destination / "checkouts" / label
    run(["git", "worktree", "add", "--detach", str(checkout), revision], source, destination / "git.log")
    if label == "original":
        actual_parent = subprocess.check_output(["git", "rev-parse", "HEAD^"], cwd=checkout, text=True).strip()
        assert actual_parent == versions["before"][0], actual_parent
    run(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], checkout, destination / f"install-{label}.log")
    for split in splits:
        name = f"{split}-{label}"
        with (research / f"{name}.log").open("xb") as output, (research / f"{name}.stderr").open("xb") as errors:
            subprocess.run(["bun", str(research / "worker.ts"), str(checkout), f"{split}-fixtures.json"],
                           cwd=research, stdout=output, stderr=errors, check=True)
for split in splits:
    names = [f"{split}-{label}" for label in versions]
    run(["node", "score.mjs", "--fixture", f"{split}-fixtures.json", "--output", f"{split}-score.json", *names],
        research, research / f"score-{split}.log")
    for before, after in [("before", "original"), ("latest", "candidate")]:
        run(["node", "compare.mjs", f"{split}-{before}", f"{split}-{after}", f"{split}-{before}-{after}.json"],
            research, research / f"compare-{split}.log")
print("Complete:", research)
