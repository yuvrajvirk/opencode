import hashlib
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import tarfile
import tempfile
import tokenize

import tomli
import yaml


root = pathlib.Path(__file__).resolve().parent
records = json.loads((root / "development-configs.json").read_text())
archives = root.parent / "context-wave3" / "archives"
binary = root / ".venv" / "bin"
results = []


def declaration(record):
    files = {item["path"]: item["text"] for item in record["files"] if "/" not in item["path"]}
    hooks = []
    parsed = yaml.safe_load(files.get(".pre-commit-config.yaml", "")) or {}
    for entry in parsed.get("repos", []):
        for hook in entry.get("hooks", []):
            name = hook.get("id")
            if name == "black" and entry.get("repo") in {
                "https://github.com/psf/black",
                "https://github.com/ambv/black",
                "https://github.com/psf/black-pre-commit-mirror",
            }:
                hooks.append({"tool": "black", "args": hook.get("args", []), "hook": hook})
            if name == "ruff-format" and entry.get("repo") == "https://github.com/astral-sh/ruff-pre-commit":
                hooks.append({"tool": "ruff", "args": hook.get("args", []), "hook": hook})
    if len(hooks) == 1:
        return {**hooks[0], "evidence": ".pre-commit-config.yaml"}
    if hooks:
        return {"tool": None, "evidence": "competing explicit formatter hooks", "hooks": hooks}
    config = tomli.loads(files.get("pyproject.toml", "")).get("tool", {})
    if "format" in config.get("ruff", {}):
        return {"tool": "ruff", "args": [], "evidence": "pyproject.toml tool.ruff.format"}
    if "black" in config:
        return {"tool": "black", "args": [], "evidence": "pyproject.toml tool.black"}
    if record["repo"] == "joke2k/faker" and "{envpython} -m black --check --line-length 120 ." in files.get("tox.ini", ""):
        return {"tool": "black", "args": ["--line-length", "120"], "evidence": "tox.ini explicit black command"}
    return {"tool": None, "evidence": "no unambiguous explicit formatter declaration"}


def perturb(content):
    text = content.decode("utf-8")
    tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    operator = next((item for item in tokens if item.type == tokenize.OP and item.string in {"=", ","}), None)
    if operator is None:
        raise ValueError("No eligible operator token")
    lines = text.splitlines(keepends=True)
    line = lines[operator.start[0] - 1]
    lines[operator.start[0] - 1] = line[:operator.start[1]] + "   " + operator.string + "   " + line[operator.end[1]:]
    mutated = "".join(lines)
    actual = [(item.type, item.string) for item in tokenize.generate_tokens(io.StringIO(mutated).readline)]
    expected = [(item.type, item.string) for item in tokens]
    if actual != expected:
        raise ValueError("Whitespace perturbation changed token sequence")
    return mutated.encode("utf-8")


def arguments(values):
    flags = {"--safe", "--quiet", "--preview", "--skip-string-normalization", "--skip-magic-trailing-comma", "-S", "-C"}
    pairs = {"--line-length", "--target-version", "-l", "-t"}
    waiting = False
    for value in values:
        if not isinstance(value, str):
            raise ValueError("Non-string formatter argument")
        if waiting:
            if not re.fullmatch(r"(?:[0-9]+|py[0-9]+)", value):
                raise ValueError("Unexpected formatter option value")
            waiting = False
        elif value in pairs:
            waiting = True
        elif value in flags:
            continue
        elif not re.fullmatch(r"--(?:line-length=[0-9]+|target-version=py[0-9]+)", value):
            raise ValueError("Unapproved formatter argument: " + value)
    if waiting:
        raise ValueError("Missing formatter option value")
    return values


for record in records:
    expected = declaration(record)
    archive_path = archives / (record["revision"] + ".tar.gz")
    assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == record["archive_sha256"]
    selected = []
    with tarfile.open(archive_path, "r:gz") as archive:
        eligible = []
        for member in archive:
            filepath = pathlib.PurePosixPath(member.name)
            if not member.isfile() or len(filepath.parts) < 2 or filepath.suffix not in {".py", ".pyi"}:
                continue
            if not 64 <= member.size <= 65536:
                continue
            relative = pathlib.PurePosixPath(*filepath.parts[1:]).as_posix()
            assert ".." not in pathlib.PurePosixPath(relative).parts
            key = hashlib.sha256((record["repo"] + "@" + record["revision"] + ":" + relative).encode()).hexdigest()
            eligible.append((key, relative, member))
        for key, relative, member in sorted(eligible)[:3]:
            extracted = archive.extractfile(member)
            assert extracted is not None
            content = extracted.read()
            fixture = {"id": key, "path": relative, "source_sha256": hashlib.sha256(content).hexdigest()}
            try:
                fixture["original"] = content.decode("utf-8")
                fixture["input"] = perturb(content).decode("utf-8")
                fixture["input_sha256"] = hashlib.sha256(fixture["input"].encode()).hexdigest()
            except (UnicodeError, ValueError, SyntaxError, tokenize.TokenError) as error:
                fixture["fixture_error"] = str(error)
            selected.append(fixture)
    with tempfile.TemporaryDirectory(prefix="opencode-formatter-oracle-") as directory:
        checkout = pathlib.Path(directory)
        (checkout / ".git").mkdir()
        home = checkout / ".isolated-home"
        home.mkdir()
        environment = {**os.environ, "HOME": str(home), "XDG_CONFIG_HOME": str(home), "BLACK_CACHE_DIR": str(home / "black-cache")}
        for file in record["files"]:
            target = checkout / file["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(file["text"])
        for fixture in selected:
            if "fixture_error" in fixture or expected["tool"] is None:
                continue
            filepath = checkout / fixture["path"]
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(fixture["input"])
            hook = expected.get("hook", {})
            excluded = not re.search(hook.get("files", ""), fixture["path"]) or bool(
                hook.get("exclude") and re.search(hook["exclude"], fixture["path"])
            )
            if excluded:
                fixture["oracle"] = {"exit_code": 0, "excluded": True, "command": [], "stderr": ""}
            else:
                command = [str(binary / expected["tool"])]
                if expected["tool"] == "ruff":
                    command.append("format")
                command.extend(arguments(expected["args"]))
                command.append(str(filepath))
                execution = subprocess.run(command, cwd=checkout, env=environment, capture_output=True, timeout=30)
                fixture["oracle"] = {
                    "exit_code": execution.returncode,
                    "excluded": False,
                    "command": [pathlib.Path(command[0]).name, *command[1:-1], fixture["path"]],
                    "stderr": execution.stderr.decode("utf-8", errors="replace").replace(str(checkout), "/workspace"),
                }
            if fixture["oracle"]["exit_code"] == 0:
                output = filepath.read_bytes()
                fixture["expected"] = output.decode("utf-8")
                fixture["expected_sha256"] = hashlib.sha256(output).hexdigest()
                fixture["oracle_changes_input"] = fixture["expected"] != fixture["input"]
    results.append({
        "repo": record["repo"],
        "revision": record["revision"],
        "split": "development",
        "archive_sha256": record["archive_sha256"],
        "declaration": expected,
        "configs": record["files"],
        "files": selected,
    })

output = {"contract": hashlib.sha256((root / "benchmark-contract.md").read_bytes()).hexdigest(), "snapshots": results}
(root / "development-fixtures.json").write_text(json.dumps(output, indent=2) + "\n")
summary = {
    "snapshots": len(results),
    "files": sum(len(record["files"]) for record in results),
    "fixture_errors": sum("fixture_error" in file for record in results for file in record["files"]),
    "by_declaration": {},
}
for tool in ["black", "ruff", None]:
    subset = [record for record in results if record["declaration"]["tool"] == tool]
    files = [file for record in subset for file in record["files"]]
    summary["by_declaration"][tool or "preservation_control"] = {
        "snapshots": len(subset),
        "repositories": len({record["repo"] for record in subset}),
        "files": len(files),
        "usable_oracles": sum("expected" in file for file in files),
        "oracle_changes_input": sum(file.get("oracle_changes_input", False) for file in files),
        "oracle_errors": sum(file.get("oracle", {}).get("exit_code", 0) != 0 for file in files),
    }
(root / "development-fixture-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
