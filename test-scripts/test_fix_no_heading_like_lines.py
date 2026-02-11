#!/usr/bin/env python3
"""
Functional test for no-heading-like-lines fixInfo: generate a file with heading-like
lines (e.g. **Summary:**, 1. **Introduction**), assert markdownlint reports errors,
run --fix, then assert file content (default fix strips emphasis to plain text).
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

RULE = "no-heading-like-lines"


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


class TestFixNoHeadingLikeLines(unittest.TestCase):
    """Test that no-heading-like-lines fixInfo (stripEmphasis) is applied by markdownlint --fix."""

    def test_fix_strip_emphasis_and_file_updated(self) -> None:
        # Minimal TOC under first h1; content under ## so no-h1-content and no-empty-heading pass.
        # Single blank lines only to avoid MD012.
        # Default fix strips emphasis (e.g. **Summary:** -> Summary:, 1. **Intro** -> Intro).
        content_before = """# Test

- [Section](#section)

## Section

**Summary:**
Content here.

1. **Introduction**
More content.
"""
        content_after = """# Test

- [Section](#section)

## Section

Summary:
Content here.

Introduction
More content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_no_heading_like_") as tmp:
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
