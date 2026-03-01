#!/usr/bin/env python3
"""
Functional test for one-sentence-per-line fixInfo: create a file with multiple
sentences on one line, assert markdownlint reports errors, run --fix, then assert
all sentences are split in one pass with correct continuation indent.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v
from markdownlint_config_helper import run_markdownlint_with_config

_REPO_ROOT = Path(__file__).resolve().parents[1]
RULE = "one-sentence-per-line"


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


class TestFixOneSentencePerLine(unittest.TestCase):
    """Test that one-sentence-per-line fixInfo is applied by markdownlint --fix."""

    def test_fix_splits_all_sentences_in_one_pass(self) -> None:
        # One run of --fix splits all sentence boundaries (paragraph).
        content_before = """# Test

- [Section](#section)

## Section

First sentence. Second sentence.
"""
        content_after = """# Test

- [Section](#section)

## Section

First sentence.
Second sentence.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")

            proc = _run_markdownlint(path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
            self.assertIn(RULE, combined, f"expected {RULE} in output")

            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")

            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual, content_after,
                "file content after --fix should match expected",
            )

    def test_fix_list_item_uses_list_continuation_indent(self) -> None:
        """Fix on a list line uses list body indent for continuation."""
        content_before = """# Doc

## Section

- One. Two.
"""
        content_after = """# Doc

## Section

- One.
  Two.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(actual, content_after)

    def test_fix_three_sentences_in_one_pass(self) -> None:
        """Three sentences on one line are all split in a single --fix run."""
        content_before = """# Doc

## Section

One. Two. Three.
"""
        content_after = """# Doc

## Section

One.
Two.
Three.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(actual, content_after)

    def test_fix_splits_after_period_before_bold(self) -> None:
        """Sentence break after period then **bold** is detected; fix splits and preserves bold."""
        content_before = """# Doc

## Section

This is the first sentence. **Bolded text** rest of the sentence.
"""
        content_after = """# Doc

## Section

This is the first sentence.
**Bolded text** rest of the sentence.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "expected lint error before fix")
            self.assertIn(RULE, (proc.stdout or "") + (proc.stderr or ""))
            proc_fix = _run_markdownlint(path, fix=True)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual, content_after,
                "fix should split at period and preserve bold",
            )

    def test_no_split_within_filenames(self) -> None:
        """Period in filenames (no space after) does not trigger split."""
        content = """# Doc

## Section

See file.name and config.json for details.
Edit utils.js or README.md.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content, encoding="utf-8")
            overrides = {"default": False, RULE: True}
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            msg = f"no one-sentence-per-line errors expected: {proc.stderr}"
            self.assertEqual(proc.returncode, 0, msg)

    def test_no_split_on_identifiers_with_periods(self) -> None:
        """Periods in identifiers (e.g. CYNAI.PROJCT) with no space after do not trigger split."""
        content = """# Doc

## Section

- CYNAI.PROJCT.ProjectGitRepos: Model (many repos per project, uniqueness per project).
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content, encoding="utf-8")
            overrides = {"default": False, RULE: True}
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            msg = f"no {RULE} errors expected: {proc.stderr}"
            self.assertEqual(proc.returncode, 0, msg)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        """With excludePathPatterns matching file, no error and fix not needed."""
        content = """# Doc

- [S](#section)

## Section

First. Second.
"""
        tmp = _REPO_ROOT / "tmp"
        tmp.mkdir(exist_ok=True)
        path = tmp / "excluded_one_sentence.md"
        rel = "tmp/excluded_one_sentence.md"
        path.write_text(content, encoding="utf-8")
        try:
            overrides = {
                "default": False,
                "one-sentence-per-line": {
                    "excludePathPatterns": ["**", "**/excluded_one_sentence.md"],
                },
            }
            proc = run_markdownlint_with_config(overrides, rel, fix=False)
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)
