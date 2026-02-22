#!/usr/bin/env python3
"""
Functional test for no-heading-like-lines fixInfo: generate a file with heading-like
lines (e.g. **Summary:**, 1. **Introduction**), assert markdownlint reports errors,
run --fix, then assert file content (default fix strips emphasis to plain text).
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v
from markdownlint_config_helper import run_markdownlint_with_config

_REPO_ROOT = Path(__file__).resolve().parents[1]
RULE = "no-heading-like-lines"


def _run_markdownlint(
    path: Path,
    fix: bool = False,
    config_overrides: dict | None = None,
) -> subprocess.CompletedProcess:
    if config_overrides:
        return run_markdownlint_with_config(config_overrides, path, fix=fix)
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

    def test_fix_convert_to_heading_option(self) -> None:
        """With convertToHeading: true, fix runs and heading-like line is fixed."""
        content_before = """# Doc

## Section

**Summary:**
Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_no_heading_like_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            overrides = {
                "default": False,
                "no-heading-like-lines": {
                    "convertToHeading": True,
                    "defaultHeadingLevel": 2,
                },
            }
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            proc_fix = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            # Fix either strips to "Summary:" or converts to "## Summary:"; both remove **
            self.assertIn("Summary", actual)
            self.assertNotIn("**Summary**", actual)

    def test_fixed_heading_level_option(self) -> None:
        """With fixedHeadingLevel: 3, suggested heading uses H3."""
        content_before = """# Doc

- [S](#section)

## Section

**Summary:**
Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_no_heading_like_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            overrides = {
                "default": False,
                "no-heading-like-lines": {
                    "convertToHeading": True,
                    "fixedHeadingLevel": 3,
                },
            }
            proc = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc.returncode, 0, f"--fix should succeed: {proc.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertIn("### Summary", actual)

    def test_fix_convert_to_heading_preserves_backticks(self) -> None:
        """With convertToHeading: true, text inside backticks in heading-like line is preserved."""
        content_before = """# Doc

## Section

**Use `# noqa: E402` here:**
Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_no_heading_like_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            overrides = {
                "default": False,
                "no-heading-like-lines": {
                    "convertToHeading": True,
                    "defaultHeadingLevel": 2,
                },
            }
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            proc_fix = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertIn(
                "`# noqa: E402`", actual,
                "inline code in heading-like line preserved when converted to heading",
            )

    def test_exclude_path_patterns_skips_rule(self) -> None:
        """With excludePathPatterns matching file, no error and fix not needed."""
        content = """# Doc

- [S](#section)

## Section

**Summary:**
Content.
"""
        tmp = _REPO_ROOT / "tmp"
        tmp.mkdir(exist_ok=True)
        path = tmp / "excluded_heading_like.md"
        rel = "tmp/excluded_heading_like.md"
        path.write_text(content, encoding="utf-8")
        try:
            overrides = {
                "default": False,
                "no-heading-like-lines": {
                    "excludePathPatterns": ["**", "**/excluded_heading_like.md"],
                },
            }
            proc = run_markdownlint_with_config(overrides, rel, fix=False)
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)
