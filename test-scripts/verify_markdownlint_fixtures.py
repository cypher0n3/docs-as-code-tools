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
- the multiset of (line, rule) or (line, rule, column) matches exactly (duplicates allowed).
  When "column" is present in an error object, the rule is assumed to report at character level
  and the verifier will match actual column numbers from markdownlint output.
"""

from __future__ import annotations

import json
import os
import re
import subprocess  # nosec B404 (tooling script runs local commands)
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


EXPECT_FENCE = "```markdownlint-expect"
FENCE_END = "```"


@dataclass(frozen=True)
class ExpectedError:
    """A single expected markdownlint error: line, rule, and optional column (1-based)."""

    line: int
    rule: str
    column: Optional[int] = None


def repo_root() -> Path:
    """Return the repository root directory (parent of this script's directory)."""
    return Path(__file__).resolve().parents[1]


def find_markdownlint_cmd() -> List[str]:
    """
    Return the command to run markdownlint-cli2.

    Prefer local node_modules/.bin/markdownlint-cli2; fallback to npx markdownlint-cli2.
    """
    local = repo_root() / "node_modules" / ".bin" / "markdownlint-cli2"
    if local.exists() and os.access(local, os.X_OK):
        return [str(local)]
    return ["npx", "markdownlint-cli2"]


def list_fixture_files() -> List[Path]:
    """Return fixture paths: positive.md plus sorted negative_*.md in md_test_files."""
    md_dir = repo_root() / "md_test_files"
    positive = md_dir / "positive.md"
    negatives = sorted(md_dir.glob("negative_*.md"))
    return [positive, *negatives]


def _find_expect_block(lines: List[str], file_path: Path) -> Tuple[int, int]:
    """Return (start, end) line indices of the markdownlint-expect block. Raises if missing."""
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
    return start, end


def _parse_one_error(item: object, idx: int, file_path: Path) -> ExpectedError:
    """Parse and validate a single error object from the expectations JSON."""
    if not isinstance(item, dict):
        raise ValueError(
            f"Invalid errors[{idx}] in {file_path.as_posix()} expectations (must be object)."
        )
    line = item.get("line")
    rule = item.get("rule")
    column = item.get("column")
    if not isinstance(line, int) or line < 1 or not isinstance(rule, str) or not rule.strip():
        raise ValueError(
            f"Invalid errors[{idx}] in {file_path.as_posix()} expectations "
            "(need {line:int>=1, rule:str})."
        )
    if column is not None and (not isinstance(column, int) or column < 1):
        raise ValueError(
            f"Invalid errors[{idx}] in {file_path.as_posix()} expectations "
            '(optional "column" must be int >= 1).'
        )
    col = column if isinstance(column, int) else None
    return ExpectedError(line=line, rule=rule.strip(), column=col)


def parse_expectations(markdown: str, file_path: Path) -> Tuple[int, List[ExpectedError]]:
    """
    Parse the trailing ```markdownlint-expect JSON block from markdown.

    Returns (total, list of ExpectedError). Validates total and errors array shape.
    Raises ValueError if block missing, JSON invalid, or structure invalid.
    """
    lines = markdown.splitlines()
    start, end = _find_expect_block(lines, file_path)
    json_text = "\n".join(lines[start + 1:end]).strip()
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Invalid JSON in {file_path.as_posix()} expectations: {e.msg}"
        ) from e

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

    parsed = [_parse_one_error(item, idx, file_path) for idx, item in enumerate(errors)]

    if len(parsed) != total:
        raise ValueError(
            f"Expectation mismatch in {file_path.as_posix()}: total={total} "
            f"but errors.length={len(parsed)}"
        )
    return total, parsed


_RE_ERROR_LINE = re.compile(
    r"^[^:]+:(\d+)(?::(\d+))?\s+(?:error\s+)?(\S+)\s+"
)


def parse_markdownlint_output(output: str, file_label: str) -> List[ExpectedError]:
    """
    Parse markdownlint-cli2 stderr/stdout into a list of errors (line, rule, optional column).

    Only lines starting with file_label (e.g. "md_test_files/foo.md:") are considered.
    When output is file:line:column rule, column is captured; otherwise column is None.
    """
    errors: List[ExpectedError] = []
    prefix = file_label + ":"
    for line in output.splitlines():
        if not line.startswith(prefix):
            continue
        m = _RE_ERROR_LINE.match(line)
        if not m:
            continue
        column = int(m.group(2)) if m.group(2) else None
        errors.append(
            ExpectedError(line=int(m.group(1)), rule=m.group(3), column=column)
        )
    return errors


def _count_map_key(e: ExpectedError) -> Tuple[int, str, Optional[int]]:
    """Key for count maps: (line, rule, column)."""
    return (e.line, e.rule, e.column)


def to_count_map(errors: List[ExpectedError]) -> Dict[Tuple[int, str, Optional[int]], int]:
    """Build a multiset of (line, rule, column) -> count for comparing expected vs actual."""
    m: Dict[Tuple[int, str, Optional[int]], int] = {}
    for e in errors:
        key = _count_map_key(e)
        m[key] = m.get(key, 0) + 1
    return m


def verify_file(cmd: List[str], file_path: Path) -> None:
    """
    Run markdownlint on one fixture file and assert exit code, count, and (line, rule) multiset.

    Raises AssertionError or ValueError on mismatch; OSError/SubprocessError on run failure.
    """
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

    def line_rule_pairs(m: Dict[Tuple[int, str, Optional[int]], int]) -> set:
        return {(k[0], k[1]) for k in m}

    pairs = line_rule_pairs(exp_map) | line_rule_pairs(act_map)
    for (lr_line, lr_rule) in sorted(pairs):
        exp_sum = sum(c for (l, r, _), c in exp_map.items() if l == lr_line and r == lr_rule)
        act_sum = sum(c for (l, r, _), c in act_map.items() if l == lr_line and r == lr_rule)
        if exp_sum != act_sum:
            diff_text = (
                f"- line {lr_line} rule {lr_rule}: expected {exp_sum}, got {act_sum}"
            )
            raise AssertionError(
                f"Unexpected errors for {file_label}:\n{diff_text}\n\nOutput:\n{combined}\n"
            )
    for (l, r, col) in exp_map:
        if col is not None and exp_map[(l, r, col)] > act_map.get((l, r, col), 0):
            diff_text = (
                f"- line {l} rule {r} column {col}: expected {exp_map[(l, r, col)]}, "
                f"got {act_map.get((l, r, col), 0)}"
            )
            raise AssertionError(
                f"Unexpected errors for {file_label}:\n{diff_text}\n\nOutput:\n{combined}\n"
            )


def main() -> int:
    """
    Verify all markdownlint fixture files; print success or failure messages to stderr.

    Returns 0 if all pass, 1 if any fail.
    """
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
