#!/usr/bin/env python3
"""
Functional test for heading-title-case fixInfo: generate a file with violations,
assert markdownlint reports errors, run --fix, then assert file content matches expected.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v
from markdownlint_config_helper import run_markdownlint_with_config

_REPO_ROOT = Path(__file__).resolve().parents[1]
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

    def test_fix_heading_with_backticks_and_parentheses(self) -> None:
        """Heading with inline code (backticks) and parens: fix must target correct words."""
        content_before = """# Linter suppressions

## Python: `# noqa: E402` (module level import not at top of file)

Text.
"""
        with tempfile.TemporaryDirectory(prefix="fix_heading_title_case_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertIn("`# noqa: E402`", actual, "inline code (backticks) must be preserved")
            self.assertIn("(Module ", actual, "(module -> (Module at correct position")
            self.assertIn(" of File)", actual, "file must be fixed to File (last word)")
            self.assertNotIn("(module ", actual, "(module should have been fixed")
            self.assertNotIn(" of file)", actual, "file should have been fixed to File")

    def test_phase_a_label_unchanged_by_fix(self) -> None:
        """Single letter after 'Phase' is a label; --fix must not lowercase it."""
        content = """# Doc

## Section

Overview.

### Phase A: Fixable Rules and Scripts (One-Time)

Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_heading_title_case_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False)
            self.assertEqual(proc.returncode, 0, f"Phase A heading should pass lint: {proc.stderr}")
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertIn("Phase A:", actual, "Phase A must remain capitalized after --fix")

    def test_fix_filenames_in_parens_get_backticks_not_title_case(self) -> None:
        """Filenames like (utils.js, allow-custom-anchors.js) get backticks, not Title Case."""
        content_before = """# Suppressions

## ESLint

Rules and options.

### `security/detect-non-literal-regexp` (utils.js, allow-custom-anchors.js)

Text.
"""
        content_after = """# Suppressions

## ESLint

Rules and options.

### `security/detect-non-literal-regexp` (`utils.js`, `allow-custom-anchors.js`)

Text.
"""
        with tempfile.TemporaryDirectory(prefix="fix_heading_title_case_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual, content_after,
                "filenames in parens get backticks, not title case",
            )


class TestHeadingTitleCaseOptions(unittest.TestCase):
    """heading-title-case: config options (lowercaseWordsReplaceDefault, excludePathPatterns)."""

    def test_fix_with_lowercase_words_replace_default(self) -> None:
        content_before = """# T

- [T](#the-and-bar)

## The And Bar

Content.
"""
        with tempfile.TemporaryDirectory(prefix="fix_title_case_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "heading-title-case": {
                        "lowercaseWords": ["and"],
                        "lowercaseWordsReplaceDefault": True,
                    },
                },
                path,
                fix=True,
            )
            self.assertEqual(proc.returncode, 0)
            actual = path.read_text(encoding="utf-8")
            self.assertIn("The and Bar", actual)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

- [A](#all-lowercase-wrong)

## all lowercase wrong

Content.
"""
        tmp = _REPO_ROOT / "tmp"
        tmp.mkdir(exist_ok=True)
        path = tmp / "excluded_titlecase_fix.md"
        rel = "tmp/excluded_titlecase_fix.md"
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-title-case": {
                        "excludePathPatterns": ["**", "**/excluded_titlecase_fix.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)
