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

    def test_fix_splits_when_next_sentence_starts_with_inline_code(self) -> None:
        """Period + space + backtick: second sentence is detected; --fix splits list line."""
        content_before = """# Doc

## Section

- **Streaming:** While `isAgentStreaming()` is true, plain Enter **queues** drafts (\
`queuedAutoSend`); slash/shell run immediately. `EnterBlockedWhileLoading` documents the matrix.
"""
        content_after = """# Doc

## Section

- **Streaming:** While `isAgentStreaming()` is true, plain Enter **queues** drafts (\
`queuedAutoSend`); slash/shell run immediately.
  `EnterBlockedWhileLoading` documents the matrix.
"""
        overrides = {"default": False, RULE: True}
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            self.assertNotEqual(proc.returncode, 0, "expected lint error before fix")
            self.assertIn(RULE, (proc.stdout or "") + (proc.stderr or ""))
            proc_fix = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual,
                content_after,
                "fix should split after immediately. and keep list continuation indent",
            )

    def test_fix_indented_paragraph_uses_line_content_indent(self) -> None:
        """Indented prose: continuation matches leading spaces (no fixed default of four)."""
        content_before = """# Doc

## Section

  First. Second.
"""
        content_after = """# Doc

## Section

  First.
  Second.
"""
        overrides = {"default": False, RULE: True}
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            self.assertNotEqual(proc.returncode, 0, "expected lint error before fix")
            proc_fix = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual,
                content_after,
                "continuation should be two spaces to align with paragraph indent",
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

    def test_no_split_on_ellipsis_in_sentence(self) -> None:
        """Ellipsis (...) in the middle of a sentence does not trigger one-sentence-per-line."""
        content = """# Doc

Inference connectivity configuration... supplied by the orchestrator in the \
**PMA managed service start bundle**.
"""
        with tempfile.TemporaryDirectory(prefix="fix_one_sentence_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content, encoding="utf-8")
            overrides = {"default": False, RULE: True}
            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            msg = f"no {RULE} errors expected for ellipsis in sentence: {proc.stderr}"
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


class TestFixOneSentencePerLineCrossLine(unittest.TestCase):
    """Functional tests for one-sentence-per-line `checkCrossLine` behavior and fix."""

    CROSS_ON_OVERRIDES = {
        "default": False,
        RULE: {"checkCrossLine": True},
    }

    def _run_fix_and_assert(
        self,
        before: str,
        after: str,
        overrides: dict,
        *,
        passes: int = 1,
    ) -> None:
        """Write `before` to temp .md, run --fix `passes` times; final pass must converge (rc 0)."""
        with tempfile.TemporaryDirectory(prefix="fix_cross_line_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(before, encoding="utf-8")
            for i in range(passes):
                proc = run_markdownlint_with_config(overrides, path, fix=True)
                is_final = i == passes - 1
                if is_final:
                    self.assertEqual(
                        proc.returncode, 0,
                        f"--fix should converge on pass {i + 1}: {proc.stderr}",
                    )
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(actual, after)

    def test_fix_joins_wrapped_paragraph_in_one_pass(self) -> None:
        """A two-line wrapped paragraph joins to one line in a single --fix pass."""
        before = """# Doc

## Section

Promote this draft into canonical docs before
implementation.
"""
        after = """# Doc

## Section

Promote this draft into canonical docs before implementation.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_fix_joins_wrapped_list_item_strips_continuation_indent(self) -> None:
        """Wrapped list item joins to one line, stripping the 2-space continuation indent."""
        before = """# Doc

## Section

- First part of the sentence
  keeps going here.
"""
        after = """# Doc

## Section

- First part of the sentence keeps going here.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_fix_converges_on_multiple_wraps_in_one_pass(self) -> None:
        """A three-line chained wrap collapses to one line in a single --fix pass."""
        before = """# Doc

## Section

alpha beta gamma
delta epsilon
zeta eta theta.
"""
        after = """# Doc

## Section

alpha beta gamma delta epsilon zeta eta theta.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_sub_check_disable_block_suppresses_cross_line_only(self) -> None:
        """`check_cross_line disable`/`enable` block turns off cross-line but leaves per-line."""
        content = """# Doc

## Section

<!-- one-sentence-per-line check_cross_line disable -->
first part of the sentence
keeps going here.
<!-- one-sentence-per-line check_cross_line enable -->

Alpha. Beta.
"""
        with tempfile.TemporaryDirectory(prefix="fix_cross_line_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(self.CROSS_ON_OVERRIDES, path, fix=False)
            output = (proc.stdout or "") + (proc.stderr or "")
            self.assertNotEqual(proc.returncode, 0, "per-line violation should still fire")
            self.assertIn("multiple sentences", output)
            self.assertNotIn("continues on next line", output)

    def test_max_file_lines_for_cross_line_skips_large_file(self) -> None:
        """A file over `maxFileLinesForCrossLine` skips cross-line but runs per-line."""
        lines = ["# Doc", "", "## Section", "", "wrapped line one", "continues here."]
        lines.extend([f"filler line {i}" for i in range(20)])
        before = "\n".join(lines) + "\n"
        overrides = {
            "default": False,
            RULE: {"checkCrossLine": True, "maxFileLinesForCrossLine": 10},
        }
        with tempfile.TemporaryDirectory(prefix="fix_cross_line_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(before, encoding="utf-8")
            proc = run_markdownlint_with_config(overrides, path, fix=False)
            self.assertEqual(
                proc.returncode, 0,
                f"no cross-line errors expected on oversized file: {proc.stderr}",
            )

    def test_fix_joins_when_next_line_is_only_inline_code_spans(self) -> None:
        """
        Next line made entirely of inline-code spans + punctuation still joins
        (was a regression).
        """
        before = """# Doc

## Section

- [x] New file `internal/agent/debug.go`: helpers `formatDebugRequest`,
  `formatDebugEvent`, `buildDebugRequest`, `injectDebugRequest`.
"""
        after = """# Doc

## Section

- [x] New file `internal/agent/debug.go`: helpers `formatDebugRequest`, \
`formatDebugEvent`, `buildDebugRequest`, `injectDebugRequest`.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_fix_joins_when_open_line_ends_with_inline_code(self) -> None:
        """Open line ending with a backtick code span (no terminal punct) still joins."""
        before = """# Doc

## Section

- See details below `foo`
  is the answer.
"""
        after = """# Doc

## Section

- See details below `foo` is the answer.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_fix_collapses_all_wraps_in_numbered_list_under_default_guard(self) -> None:
        """Numbered list with many short 2-line wraps is fully fixable under the default guard."""
        before = """# Doc

## Section

1. item one
   continues A.
2. item two
   continues B.
3. item three
   continues C.
4. item four
   continues D.
5. item five
   continues E.
6. item six
   continues F.
"""
        after = """# Doc

## Section

1. item one continues A.
2. item two continues B.
3. item three continues C.
4. item four continues D.
5. item five continues E.
6. item six continues F.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_fix_collapses_all_wraps_in_large_bullet_list_under_default_guard(self) -> None:
        """
        Dense bullet lists with many short 2-line wraps are all fixable under the default guard.
        """
        before = """# Doc

## Section

- [x] bullet one
  continues A.
- [x] bullet two
  continues B.
- [x] bullet three
  continues C.
- [x] bullet four
  continues D.
- [x] bullet five
  continues E.
- [x] bullet six
  continues F.
"""
        after = """# Doc

## Section

- [x] bullet one continues A.
- [x] bullet two continues B.
- [x] bullet three continues C.
- [x] bullet four continues D.
- [x] bullet five continues E.
- [x] bullet six continues F.
"""
        self._run_fix_and_assert(before, after, self.CROSS_ON_OVERRIDES)

    def test_max_block_lines_for_fix_guard_reports_without_fix(self) -> None:
        """`maxBlockLinesForFix: 1` reports wraps but emits no fixInfo (file unchanged)."""
        before = """# Doc

## Section

first part of the sentence
keeps going here.
"""
        overrides = {
            "default": False,
            RULE: {"checkCrossLine": True, "maxBlockLinesForFix": 1},
        }
        with tempfile.TemporaryDirectory(prefix="fix_cross_line_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(before, encoding="utf-8")
            proc = run_markdownlint_with_config(overrides, path, fix=False)
            self.assertNotEqual(proc.returncode, 0, "cross-line violation should be reported")
            self.assertIn(RULE, (proc.stdout or "") + (proc.stderr or ""))
            proc_fix = run_markdownlint_with_config(overrides, path, fix=True)
            self.assertNotEqual(
                proc_fix.returncode, 0,
                "--fix should still surface the violation (no fixInfo)",
            )
            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual, before,
                "file should be unchanged when maxBlockLinesForFix prevents fixInfo",
            )
