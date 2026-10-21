import argparse
import hashlib
import json
import pathlib
import re
import tarfile


root = pathlib.Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--split", choices=["development", "heldout"], default="development")
options = parser.parse_args()
source = root.parent / "context-wave3"
corpus_bytes = (source / "grep-corpus.json").read_bytes()
manifest_bytes = (source / "snapshot-manifest.json").read_bytes()
assert hashlib.sha256(corpus_bytes).hexdigest() == "d0400372543c08b81faef89ffcbcc8e2500cf8ec7b2fcc45f8a84b2ee738ca35"
assert hashlib.sha256(manifest_bytes).hexdigest() == "335d46da90bccefa30845040e4a9eecb94a72ec58a8b49ce1369e4a9d9b6f060"
cases = [item for item in json.loads(corpus_bytes)["cases"] if item["split"] == options.split]
manifest = {item["revision"]: item for item in json.loads(manifest_bytes)}
names = {"pyproject.toml", "Pipfile", "setup.cfg", ".pre-commit-config.yaml", "tox.ini"}
patterns = {
    "black_section": re.compile(r"^\s*\[tool\.black\]\s*(?:#.*)?$", re.MULTILINE),
    "black_hook": re.compile(r"^\s*(?:-\s*)?repo:\s*['\"]?https://github\.com/(?:psf/black|ambv/black)\b", re.MULTILINE),
    "ruff_format_section": re.compile(r"^\s*\[tool\.ruff\.format\]\s*(?:#.*)?$", re.MULTILINE),
    "ruff_format_hook": re.compile(r"^\s*(?:-\s*)?id:\s*['\"]?ruff-format\b", re.MULTILINE),
    "black_word": re.compile(r"\bblack\b", re.IGNORECASE),
    "ruff_word": re.compile(r"\bruff\b", re.IGNORECASE),
}
records = []
for case in cases:
    archive_path = source / "archives" / (case["revision"] + ".tar.gz")
    archive_hash = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    assert archive_hash == manifest[case["revision"]]["sha256"], str(archive_path)
    files = []
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            member_path = pathlib.PurePosixPath(member.name)
            if not member.isfile() or len(member_path.parts) < 2:
                continue
            name = member_path.name
            if name not in names and not (name.startswith("requirements") and name.endswith(".txt")):
                continue
            relative = pathlib.PurePosixPath(*member_path.parts[1:]).as_posix()
            extracted = archive.extractfile(member)
            assert extracted is not None
            content = extracted.read()
            text = content.decode("utf-8", errors="replace")
            files.append({
                "path": relative,
                "sha256": hashlib.sha256(content).hexdigest(),
                "bytes": len(content),
                "utf8_exact": text.encode("utf-8") == content,
                "text": text,
                "signals": {label: bool(pattern.search(text)) for label, pattern in patterns.items()},
            })
    records.append({
        "repo": case["repo"],
        "revision": case["revision"],
        "split": case["split"],
        "archive_sha256": archive_hash,
        "files": sorted(files, key=lambda item: item["path"]),
    })

(root / f"{options.split}-configs.json").write_text(json.dumps(records, indent=2) + "\n")
summary = {
    "snapshots": len(records),
    "repositories": len({item["repo"] for item in records}),
    "configuration_files": sum(len(item["files"]) for item in records),
    "non_utf8_files": sum(not item["utf8_exact"] for record in records for item in record["files"]),
    "signals_not_ground_truth": {},
}
for label in patterns:
    for scope in ["all_paths", "root_only"]:
        selected = [record for record in records if any(
            item["signals"][label] and (scope == "all_paths" or "/" not in item["path"])
            for item in record["files"]
        )]
        summary["signals_not_ground_truth"][label + ":" + scope] = {
            "snapshots": len(selected),
            "repositories": len({item["repo"] for item in selected}),
        }
(root / f"{options.split}-survey.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
