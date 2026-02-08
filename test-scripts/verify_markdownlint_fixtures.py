#!/usr/bin/env python3
"""
Verify markdownlint fixture expectations from md_test_files/expected_errors.yml.

Expected errors are keyed by fixture filename (e.g. positive.md, negative_*.md).
The verifier runs markdownlint-cli2 on each fixture and asserts:
- exit code matches (0 for total=0, non-zero otherwise)
- total error count matches
- the multiset of (line, rule) or (line, rule, column) matches exactly (duplicates allowed).
  When "column" is present in an error object, the rule is assumed to report at character level
  and the verifier will match actual column numbers from markdownlint output.
- optionally, each error may specify message_contains: the actual error message (text after
  the rule name in markdownlint output) must contain that string, so the specific error on
  each line can be validated.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess  # nosec B404 (tooling script runs local commands)
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


@dataclass(frozen=True)
class ExpectedError:
    """
    A single expected markdownlint error: line, rule, optional column (1-based),
    and optional message_contains (substring that must appear in the actual error message).
    When parsed from markdownlint output, message is set to the full message text.
    """

    line: int
    rule: str
    column: Optional[int] = None
    message_contains: Optional[str] = None
    message: Optional[str] = None  # Set when parsing actual output; not from YAML


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
    msg_contains = item.get("message_contains")
    if msg_contains is not None and not isinstance(msg_contains, str):
        raise ValueError(
            f"Invalid errors[{idx}] in {file_path.as_posix()} expectations "
            '(optional "message_contains" must be a string).'
        )
    col = column if isinstance(column, int) else None
    msg_c = msg_contains if isinstance(msg_contains, str) else None
    return ExpectedError(line=line, rule=rule.strip(), column=col, message_contains=msg_c)


def load_expected_errors(expect_path: Path) -> Dict[str, Any]:
    """Load expected_errors.yml; return dict keyed by fixture filename."""
    if not expect_path.exists():
        raise FileNotFoundError(f"Expected errors file not found: {expect_path}")
    text = expect_path.read_text(encoding="utf-8")
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML in {expect_path}: {e}") from e
    if not isinstance(data, dict):
        raise ValueError(f"Expected errors file must be a YAML object: {expect_path}")
    return data


def parse_expectations_from_data(
    data: Any, file_path: Path
) -> Tuple[int, List[ExpectedError]]:
    """
    Parse expectations from a dict with an "errors" list. Total is derived from len(errors).

    Returns (total, list of ExpectedError). Raises ValueError if structure invalid.
    """
    if not isinstance(data, dict):
        raise ValueError(
            f"Expectations for {file_path.as_posix()} must be an object."
        )
    errors = data.get("errors")
    if not isinstance(errors, list):
        raise ValueError(
            f'Invalid "errors" in {file_path.as_posix()} expectations (must be an array).'
        )

    parsed = [_parse_one_error(item, idx, file_path) for idx, item in enumerate(errors)]
    return len(parsed), parsed


_RE_ERROR_LINE = re.compile(
    r"^[^:]+:(\d+)(?::(\d+))?\s+(?:error\s+)?(\S+)\s+(.*)$"
)


def parse_markdownlint_output(output: str, file_label: str) -> List[ExpectedError]:
    """
    Parse markdownlint-cli2 stderr/stdout into a list of errors (line, rule, column, message).

    Only lines starting with file_label (e.g. "md_test_files/foo.md:") are considered.
    Captures optional column and the rest of the line as the error message.
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
        message = (m.group(4) or "").strip()
        errors.append(
            ExpectedError(
                line=int(m.group(1)),
                rule=m.group(3),
                column=column,
                message=message,
            )
        )
    return errors


def _count_map_key(e: ExpectedError) -> Tuple[int, str, Optional[int]]:
    """Key for count maps: (line, rule, column). Message fields are ignored."""
    return (e.line, e.rule, e.column)


def to_count_map(errors: List[ExpectedError]) -> Dict[Tuple[int, str, Optional[int]], int]:
    """Build a multiset of (line, rule, column) -> count for comparing expected vs actual."""
    m: Dict[Tuple[int, str, Optional[int]], int] = {}
    for e in errors:
        key = _count_map_key(e)
        m[key] = m.get(key, 0) + 1
    return m


def _assert_message_contains(
    exp_errors: List[ExpectedError],
    act_errors: List[ExpectedError],
    file_label: str,
    combined: str,
) -> None:
    """Raise AssertionError if any expected message_contains is not found in actual messages."""
    for exp in exp_errors:
        if exp.message_contains is None:
            continue
        candidates = [
            a for a in act_errors
            if a.line == exp.line and a.rule == exp.rule
            and (exp.column is None or a.column == exp.column)
        ]
        if not candidates:
            raise AssertionError(
                f"Unexpected errors for {file_label}: no actual error at line {exp.line} "
                f"rule {exp.rule} to check message_contains.\n\nOutput:\n{combined}\n"
            )
        if not any(
            (a.message or "").find(exp.message_contains) >= 0 for a in candidates
        ):
            raise AssertionError(
                f"Unexpected error message for {file_label} at line {exp.line} rule {exp.rule}: "
                f'message_contains "{exp.message_contains}" not found in actual message. '
                f"Got: {candidates[0].message!r}\n\nOutput:\n{combined}\n"
            )


def verify_file(
    cmd: List[str], file_path: Path, expectations_by_file: Dict[str, Any]
) -> None:
    """
    Run markdownlint on one fixture file and assert exit code, count, and (line, rule) multiset.

    Raises AssertionError or ValueError on mismatch; OSError/SubprocessError on run failure.
    """
    key = file_path.name
    if key not in expectations_by_file:
        raise ValueError(f"No expectations in expected_errors.yml for {key}")
    exp_total, exp_errors = parse_expectations_from_data(
        expectations_by_file[key], file_path
    )

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

    _assert_message_contains(exp_errors, act_errors, file_label, combined)


def main() -> int:
    """
    Verify all markdownlint fixture files; print success or failure messages to stderr.

    Returns 0 if all pass, 1 if any fail.
    """
    parser = argparse.ArgumentParser(description="Verify markdownlint fixture expectations.")
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print each fixture as it is verified.",
    )
    args = parser.parse_args()
    verbose = args.verbose

    cmd = find_markdownlint_cmd()
    files = list_fixture_files()
    expect_path = repo_root() / "md_test_files" / "expected_errors.yml"
    expectations_by_file = load_expected_errors(expect_path)
    failures: List[str] = []

    for f in files:
        if verbose:
            exp_total = 0
            if f.name in expectations_by_file:
                err_list = expectations_by_file[f.name].get("errors") or []
                exp_total = len(err_list)
            file_label = f.relative_to(repo_root()).as_posix()
            plural = "" if exp_total == 1 else "s"
            sys.stderr.write(
                f"Verifying {file_label} ({exp_total} expected error{plural}) ... "
            )
        try:
            verify_file(cmd, f, expectations_by_file)
            if verbose:
                sys.stderr.write("ok\n")
        except (AssertionError, ValueError, OSError, subprocess.SubprocessError) as e:
            if verbose:
                sys.stderr.write("FAIL\n")
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
