#!/usr/bin/env python3
"""
Verify markdownlint fixture expectations embedded in md_test_files/*.md.

Each fixture must contain a trailing fenced code block:

```markdownlint-expect
{
  "total": 2,
  "errors": [
    { "line": 10, "rule": "MD032/blanks-around-lists" }
  ]
}
```

The verifier runs markdownlint-cli2 on each fixture and asserts:
- exit code matches (0 for total=0, non-zero otherwise)
- total error count matches
- the multiset of (line, rule) matches exactly (duplicates allowed)
"""

from __future__ import annotations

import json
import os
import re
import subprocess  # nosec B404 (tooling script runs local commands)
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


EXPECT_FENCE = "```markdownlint-expect"
FENCE_END = "```"


@dataclass(frozen=True)
class ExpectedError:
    line: int
    rule: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def find_markdownlint_cmd() -> List[str]:
    """
    Prefer local node_modules/.bin/markdownlint-cli2.
    Fallback: npx markdownlint-cli2
    """
    local = repo_root() / "node_modules" / ".bin" / "markdownlint-cli2"
    if local.exists() and os.access(local, os.X_OK):
        return [str(local)]
    return ["npx", "markdownlint-cli2"]


def list_fixture_files() -> List[Path]:
    md_dir = repo_root() / "md_test_files"
    positive = md_dir / "positive.md"
    negatives = sorted(md_dir.glob("negative_*.md"))
    return [positive, *negatives]


def parse_expectations(markdown: str, file_path: Path) -> Tuple[int, List[ExpectedError]]:
    lines = markdown.splitlines()

    start = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == EXPECT_FENCE:
            start = i
            break
    if start is None:
        raise ValueError(f"Missing `{EXPECT_FENCE}` block in {file_path.as_posix()}")

    end = None
    for i in range(start + 1, len(lines)):
        if lines[i].strip() == FENCE_END:
            end = i
            break
    if end is None:
        raise ValueError(f"Unterminated `{EXPECT_FENCE}` block in {file_path.as_posix()}")

    json_text = "\n".join(lines[start + 1:end]).strip()
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {file_path.as_posix()} expectations: {e.msg}") from e

    total = data.get("total")
    errors = data.get("errors")
    if not isinstance(total, int) or total < 0:
        raise ValueError(
            f'Invalid "total" in {file_path.as_posix()} expectations (must be non-negative int).'
        )
    if not isinstance(errors, list):
        raise ValueError(
            f'Invalid "errors" in {file_path.as_posix()} expectations (must be an array).'
        )

    parsed: List[ExpectedError] = []
    for idx, item in enumerate(errors):
        if not isinstance(item, dict):
            raise ValueError(
                f"Invalid errors[{idx}] in {file_path.as_posix()} expectations (must be object)."
            )
        line = item.get("line")
        rule = item.get("rule")
        if not isinstance(line, int) or line < 1 or not isinstance(rule, str) or not rule.strip():
            raise ValueError(
                (
                    f"Invalid errors[{idx}] in {file_path.as_posix()} expectations "
                    f"(need {{line:int>=1, rule:str}})."
                )
            )
        parsed.append(ExpectedError(line=line, rule=rule.strip()))

    if len(parsed) != total:
        raise ValueError(
            (
                f"Expectation mismatch in {file_path.as_posix()}: total={total} "
                f"but errors.length={len(parsed)}"
            )
        )

    return total, parsed


_RE_ERROR_LINE = re.compile(r"^[^:]+:(\d+)(?::\d+)?\s+(?:error\s+)?(\S+)\s+")


def parse_markdownlint_output(output: str, file_label: str) -> List[ExpectedError]:
    errors: List[ExpectedError] = []
    prefix = file_label + ":"
    for line in output.splitlines():
        if not line.startswith(prefix):
            continue
        m = _RE_ERROR_LINE.match(line)
        if not m:
            continue
        errors.append(ExpectedError(line=int(m.group(1)), rule=m.group(2)))
    return errors


def to_count_map(errors: List[ExpectedError]) -> Dict[Tuple[int, str], int]:
    m: Dict[Tuple[int, str], int] = {}
    for e in errors:
        key = (e.line, e.rule)
        m[key] = m.get(key, 0) + 1
    return m


def verify_file(cmd: List[str], file_path: Path) -> None:
    markdown = file_path.read_text(encoding="utf-8")
    exp_total, exp_errors = parse_expectations(markdown, file_path)

    file_label = file_path.relative_to(repo_root()).as_posix()
    proc = subprocess.run(
        [*cmd, file_label],
        cwd=repo_root(),
        text=True,
        capture_output=True,
        check=False,
    )  # nosec B603 (file list and command are controlled by repository code)
    combined = (
        (proc.stdout or "")
        + ("\n" if proc.stdout and proc.stderr else "")
        + (proc.stderr or "")
    )
    combined = combined.strip()

    act_errors = parse_markdownlint_output(combined, file_label)

    exp_ok = not exp_total
    act_ok = not proc.returncode
    if exp_ok != act_ok:
        want = 0 if exp_ok else "non-zero"
        raise AssertionError((
            f"Unexpected exit code for {file_label}: expected {want}, got {proc.returncode}"
            f"\n\nOutput:\n{combined}\n"
        ))

    if len(act_errors) != exp_total:
        raise AssertionError((
            f"Unexpected error count for {file_label}: expected {exp_total}, got {len(act_errors)}"
            f"\n\nOutput:\n{combined}\n"
        ))

    exp_map = to_count_map(exp_errors)
    act_map = to_count_map(act_errors)
    if exp_map != act_map:
        keys = sorted(set(exp_map.keys()) | set(act_map.keys()))
        diffs = []
        for k in keys:
            e = exp_map.get(k, 0)
            a = act_map.get(k, 0)
            if e != a:
                diffs.append(f"- line {k[0]} rule {k[1]}: expected {e}, got {a}")
        diff_text = "\n".join(diffs)
        raise AssertionError(
            f"Unexpected errors for {file_label}:\n{diff_text}\n\nOutput:\n{combined}\n"
        )


def main() -> int:
    cmd = find_markdownlint_cmd()
    files = list_fixture_files()
    failures: List[str] = []

    for f in files:
        try:
            verify_file(cmd, f)
        except (AssertionError, ValueError, OSError, subprocess.SubprocessError) as e:
            failures.append(str(e))

    if failures:
        sys.stderr.write(f"markdownlint fixture verification failed ({len(failures)} file(s)):\n\n")
        for msg in failures:
            sys.stderr.write(msg.rstrip() + "\n\n")
        return 1

    print("All markdownlint fixture expectations matched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
