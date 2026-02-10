#!/usr/bin/env python3
"""
Functional test for heading-title-case fixInfo: generate a file with violations,
assert markdownlint reports errors, run --fix, then assert file content matches expected.
"""

from __future__ import annotations

import subprocess  # nosec B404
import sys
import tempfile
import unittest
from pathlib import Path

# Repo root and verifier helpers
_REPO_ROOT = Path(__file__).resolve().parents[1]
_TEST_SCRIPTS = _REPO_ROOT / "test-scripts"
if str(_TEST_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_TEST_SCRIPTS))

import verify_markdownlint_fixtures as v  # noqa: E402

RULE = "heading-title-case"


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


class TestFixHeadingTitleCase(unittest.TestCase):
    """Test that heading-title-case fixInfo is applied by markdownlint --fix."""

    def test_fix_applied_and_file_updated(self) -> None:
        content_before = """# Title

## getting started

Lowercase first word.

## The Cat And the Hat

Middle "And" should be lowercase.

## Using Tools in practice

Last word "practice" should be capitalized.
"""
        content_after = """# Title

## Getting Started

Lowercase first word.

## The Cat and the Hat

Middle "And" should be lowercase.

## Using Tools in Practice

Last word "practice" should be capitalized.
"""
        with tempfile.TemporaryDirectory(prefix="fix_heading_title_case_") as tmp:
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
