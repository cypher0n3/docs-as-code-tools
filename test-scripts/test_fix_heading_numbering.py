#!/usr/bin/env python3
"""
Functional test for heading-numbering fixInfo: generate a file with numbering
violations (e.g. wrong sequence), assert markdownlint reports errors, run --fix,
then assert file content.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v

RULE = "heading-numbering"


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


class TestFixHeadingNumbering(unittest.TestCase):
    """Test that heading-numbering fixInfo is applied by markdownlint --fix."""

    def test_fix_sequence_and_file_updated(self) -> None:
        # Wrong sequence: ### 3. should be ### 2. (sibling of ### 1.)
        # Include h1 and content under ## Root so MD041 and no-empty-heading pass.
        content_before = """# Doc Title

- [Root](#root)

## Root

Intro under root.

### 1. First

Content.

### 3. Second

Content.
"""
        content_after = """# Doc Title

- [Root](#root)

## Root

Intro under root.

### 1. First

Content.

### 2. Second

Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_heading_numbering_") as tmp:
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
