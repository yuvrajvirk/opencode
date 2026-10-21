import argparse
import hashlib
import json
import pathlib
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
manifest = {item["revision"]: item for item in json.loads(manifest_bytes)}
cases = [item for item in json.loads(corpus_bytes)["cases"] if item["split"] == options.split]
bands = [("small", 1024, 16 * 1024), ("medium", 16 * 1024, 128 * 1024), ("large", 128 * 1024, 2 * 1024 * 1024 + 1)]
records = []
for case in cases:
    archive_path = source / "archives" / (case["revision"] + ".tar.gz")
    expected = manifest[case["revision"]]["sha256"]
    assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == expected
    selected = []
    absent = []
    rejected = []
    with tarfile.open(archive_path, "r:gz") as archive:
        candidates = []
        for member in archive.getmembers():
            name = pathlib.PurePosixPath(member.name)
            if not member.isfile() or len(name.parts) < 2:
                continue
            relative = pathlib.PurePosixPath(*name.parts[1:]).as_posix()
            assert ".." not in pathlib.PurePosixPath(relative).parts
            identity = hashlib.sha256((case["repo"] + "@" + case["revision"] + ":" + relative).encode()).hexdigest()
            candidates.append((identity, relative, member))
        candidates.sort(key=lambda entry: entry[0])
        for band, minimum, maximum in bands:
            found = False
            for identity, relative, member in candidates:
                if not minimum <= member.size < maximum:
                    continue
                extracted = archive.extractfile(member)
                assert extracted is not None
                content = extracted.read()
                try:
                    text = content.decode("utf-8")
                except UnicodeError:
                    rejected.append({"path": relative, "band": band, "reason": "not UTF-8"})
                    continue
                if "\x00" in text:
                    rejected.append({"path": relative, "band": band, "reason": "NUL byte"})
                    continue
                assert text.encode("utf-8") == content
                selected.append({
                    "id": identity,
                    "path": relative,
                    "band": band,
                    "bytes": len(content),
                    "source_sha256": hashlib.sha256(content).hexdigest(),
                    "text": text,
                })
                found = True
                break
            if not found:
                absent.append(band)
    records.append({
        "repo": case["repo"], "revision": case["revision"], "archive_sha256": expected,
        "split": options.split, "files": selected, "absent_bands": absent, "rejected_nontext": rejected,
    })

fixture = {
    "protocol_sha256": hashlib.sha256((root / "protocol.md").read_bytes()).hexdigest(),
    "prepare_sha256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    "snapshots": records,
}
encoded = (json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
output = root / f"{options.split}-fixtures.json"
with output.open("xb") as handle:
    handle.write(encoded)
summary = {
    "fixture_sha256": hashlib.sha256(encoded).hexdigest(),
    "snapshots": len(records), "repositories": len({item["repo"] for item in records}),
    "files": sum(len(item["files"]) for item in records),
    "by_band": {band: sum(file["band"] == band for item in records for file in item["files"]) for band, _, _ in bands},
    "source_bytes": sum(file["bytes"] for item in records for file in item["files"]),
    "absent_bands": [{"repo": item["repo"], "revision": item["revision"], "bands": item["absent_bands"]} for item in records if item["absent_bands"]],
}
(root / f"{options.split}-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
