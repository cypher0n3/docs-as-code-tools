#!/usr/bin/env python3
"""
Functional test for ascii-only fixInfo: generate a file with non-ASCII that have
replacements, assert markdownlint reports errors, run --fix, then assert file content.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v

RULE = "ascii-only"


def _run_markdownlint(path: Path, fix: bool = False) -> subprocess.CompletedProcess:
    cmd = v.find_markdownlint_cmd()
    if fix:
        cmd = [*cmd, "--fix", str(path)]
    else:
        cmd = [*cmd, str(path)]
    return subprocess.run(
        cmd,
        cwd=v.repo_root(),
        text=True,
        capture_output=True,
        check=False,
    )  # nosec B603


class TestFixAsciiOnly(unittest.TestCase):
    """Test that ascii-only fixInfo is applied by markdownlint --fix."""

    def test_fix_applied_and_file_updated(self) -> None:
        # Use characters that have default unicodeReplacements: → ->, " ", ' '
        # Include minimal TOC under first h1 so no-h1-content passes.
        # Use one sentence so one-sentence-per-line does not trigger.
        content_before = """# Test

- [Section One](#section-one)

## Section One

Arrow \u2192 here and smart quotes: \u201cleft\u201d and \u2018right\u2019.
"""
        content_after = """# Test

- [Section One](#section-one)

## Section One

Arrow -> here and smart quotes: "left" and 'right'.
"""
        with tempfile.TemporaryDirectory(prefix="fix_ascii_only_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")

            # Must report errors before fix
            proc = _run_markdownlint(path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
            self.assertIn(RULE, combined, f"expected {RULE} in output")

            # Apply fix
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")

            # File content must match expected after fix
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual, content_after,
                "file content after --fix should match expected",
            )
