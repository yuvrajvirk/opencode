import hashlib
import json
import pathlib

import tomli
import yaml


root = pathlib.Path(__file__).resolve().parent
probes = [
    {
        "name": "toml-string",
        "path": "pyproject.toml",
        "text": '[project]\nname = "sample"\nversion = "0.1.0"\ndescription = """\n[tool.black]\nThis is documentation, not a formatter declaration.\n"""\n',
    },
    {
        "name": "yaml-scalar",
        "path": ".pre-commit-config.yaml",
        "text": 'notes: |\n  - repo: https://github.com/psf/black\n    hooks:\n      - id: black\nrepos: []\n',
    },
]
assert "tool" not in tomli.loads(probes[0]["text"])
assert yaml.safe_load(probes[1]["text"])["repos"] == []
content = 'answer   =   { "label" : "unchanged" }\n'
digest = hashlib.sha256(content.encode()).hexdigest()
snapshots = []
for probe in probes:
    snapshots.append({
        "repo": "independent/" + probe["name"],
        "revision": probe["name"],
        "declaration": {"tool": None},
        "configs": [{"path": probe["path"], "text": probe["text"]}],
        "files": [{
            "id": probe["name"],
            "path": "sample.py",
            "original": content,
            "input": content,
            "expected": content,
            "expected_sha256": digest,
        }],
    })
(root / "post-prototype-probes.json").write_text(json.dumps({"snapshots": snapshots}, indent=2) + "\n")
