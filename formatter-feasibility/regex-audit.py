import json
import pathlib
import re
import sys


root = pathlib.Path(__file__).resolve().parent
patterns = [
    "", r"^src/", r"\.py$", r"^(src|tests)/", r"^src/[^/]+\.py$",
    r"\Asrc/", r"\.py\Z", r"^src/\w+\.py$", r"^src/\W+\.py$",
    r"^src/\d+\.py$", r"^src/\D+\.py$", r"^src/\s+\.py$", r"^src/\S+\.py$",
    r"\btest\b", r"(?i)^src/", r"(?m)^src/", r"(?s)^src/.*\.py$",
    "(?x)^ (src | tests) / [^/]+ \\.py $ # file\n",
    r"(?x)^src/[ #]+\.py$", r"(?x)^src/\ \#\.py$",
    r"^(?P<directory>src)/", r"^(src)/\1\.py$", r"^src/[]a]+\.py$",
    r"^src/[^]a]+\.py$", r"^src/.*\.py$", r"^src/.+\.py$",
    r"^src/(?!generated/).*\.py$", r"(?<=src/)example\.py$", r"^src/[a-z]+\.py$",
    r"^src/[0-9]+\.py$", r"^src/\x61+\.py$", r"^src/\u00e9+\.py$",
    r"^src/\U0001F40D\.py$", r"^src/(?:test_)?example\.py$",
]
paths = [
    "example.py", "src/example.py", "tests/example.py", "docs/example.py", "SRC/example.py",
    "src/generated/example.py", "src/test_example.py", "src/test.py", "src/testé.py", "src/étest.py",
    "src/src.py", "src/é.py", "src/蛇.py", "src/🐍.py", "src/123.py", "src/١٢٣.py", "src/².py",
    "src/ .py", "src/ #.py", "src/#.py", "src/].py", "src/a.py", "src/aa.py", "src/\t.py",
    "src/\x1c.py", "src/\ufeff.py", "src/\r.py", "src/\n.py", "src/\u2028.py",
]
for record in json.loads((root / "development-fixtures.json").read_text())["snapshots"]:
    for config in [record["declaration"].get("hook", {}), record["declaration"].get("root_filter", {})]:
        patterns.extend(config[key] for key in ["files", "exclude"] if key in config)
patterns = list(dict.fromkeys(patterns))
result = {
    "scope": "Supplementary post-prototype Python re filter semantics; not untouched holdout",
    "reference": "https://docs.python.org/3/library/re.html#regular-expression-syntax",
    "python": sys.version,
    "patterns": [
        {"pattern": pattern, "cases": [{"path": path, "matches": bool(re.search(pattern, path))} for path in paths]}
        for pattern in patterns
    ],
}
(root / "regex-audit-fixtures.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"patterns": len(patterns), "paths": len(paths), "cases": len(patterns) * len(paths)}))
