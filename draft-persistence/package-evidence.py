import gzip
import hashlib
import json
import pathlib
import shutil


root = pathlib.Path(__file__).resolve().parent
destination = root.parent / "draft-evidence"
destination.mkdir(exist_ok=True)
target = destination / "draft-persistence"
target.mkdir(exist_ok=True)
excluded = {"development-fixtures.json", "heldout-fixtures.json", "diagnostic-fixtures.json", "next-feature-screen.json", "next-feature-screen.md", "publication-packaging.log"}
for name in excluded:
    for suffix in ["", ".gz"]:
        stale = target / (name + suffix)
        if stale.is_file():
            stale.unlink()


def publish(source, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix in {".log", ".stderr"} or (source.suffix == ".json" and source.stat().st_size > 1024 * 1024):
        with source.open("rb") as input_file, pathlib.Path(str(output) + ".gz").open("wb") as output_file:
            with gzip.GzipFile(filename="", mode="wb", fileobj=output_file, mtime=0) as compressor:
                shutil.copyfileobj(input_file, compressor)
    else:
        shutil.copy2(source, output)


for source in root.iterdir():
    if source.is_file() and source.name not in excluded and source.suffix in {".py", ".ts", ".mjs", ".md", ".patch", ".json", ".txt", ".log", ".stderr"}:
        publish(source, target / source.name)
for folder in ["cost-weighted", "cost-pressure", "cost-terminal-final"]:
    for source in (root / folder).iterdir():
        if source.is_file():
            publish(source, target / folder / source.name)
fresh = root.parent / "draft-persistence-clean-reproduction"
for source in (fresh / "draft-persistence").iterdir():
    if source.is_file() and source.name not in excluded and source.suffix in {".log", ".stderr", ".json"}:
        publish(source, target / "clean-reproduction" / source.name)
for source in fresh.iterdir():
    if source.is_file() and source.suffix == ".log":
        publish(source, target / "clean-reproduction" / source.name)
for name in ["grep-corpus.json", "snapshot-manifest.json"]:
    publish(root.parent / "context-wave3" / name, destination / "context-wave3" / name)
publish(pathlib.Path("/home/yvirk2/opencode/LICENSE"), destination / "LICENSE-OpenCode")
manifest = {
    str(file.relative_to(destination)): hashlib.sha256(file.read_bytes()).hexdigest()
    for file in sorted(destination.rglob("*"))
    if file.is_file() and ".git" not in file.parts and file.name != "artifact-hashes.json"
}
(destination / "artifact-hashes.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(len(manifest), "artifacts in", destination)
