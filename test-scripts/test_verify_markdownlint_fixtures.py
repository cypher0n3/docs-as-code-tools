#!/usr/bin/env python3
"""
Unit tests for verify_markdownlint_fixtures.py.

Tests parsing of markdownlint-expect blocks, markdownlint output parsing,
and multiset comparison. Does not require markdownlint-cli2 except for
integration-style tests (skipped when unavailable).
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

# Repo root (parent of test-scripts). Add test-scripts to path so we can import the verifier.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_TEST_SCRIPTS = _REPO_ROOT / "test-scripts"
if str(_TEST_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_TEST_SCRIPTS))

import verify_markdownlint_fixtures as v  # noqa: E402


class TestRepoRoot(unittest.TestCase):
    """Tests for repo_root()."""

    def test_returns_path(self):
        root = v.repo_root()
        self.assertIsInstance(root, Path)
        self.assertTrue(root.is_dir())

    def test_contains_test_scripts_and_fixtures(self):
        root = v.repo_root()
        self.assertTrue((root / "test-scripts").is_dir(), "test-scripts dir missing")
        self.assertTrue((root / "md_test_files").is_dir(), "md_test_files dir missing")


class TestFindMarkdownlintCmd(unittest.TestCase):
    """Tests for find_markdownlint_cmd()."""

    def test_returns_list(self):
        cmd = v.find_markdownlint_cmd()
        self.assertIsInstance(cmd, list)
        self.assertGreaterEqual(len(cmd), 1)

    def test_first_element_is_executable_name(self):
        cmd = v.find_markdownlint_cmd()
        self.assertTrue(cmd[0].endswith("markdownlint-cli2") or cmd[0] == "npx")


class TestListFixtureFiles(unittest.TestCase):
    """Tests for list_fixture_files()."""

    def test_returns_list_of_paths(self):
        files = v.list_fixture_files()
        self.assertIsInstance(files, list)
        for f in files:
            self.assertIsInstance(f, Path)

    def test_first_is_positive_md(self):
        files = v.list_fixture_files()
        self.assertGreater(len(files), 0)
        self.assertEqual(files[0].name, "positive.md")

    def test_rest_are_negative_md(self):
        files = v.list_fixture_files()
        for f in files[1:]:
            self.assertTrue(f.name.startswith("negative_"), f"{f.name} should be negative_*.md")
            self.assertTrue(f.name.endswith(".md"))


class TestParseExpectations(unittest.TestCase):
    """Tests for parse_expectations()."""

    def _parse(self, markdown: str, path: str = "test.md") -> tuple:
        return v.parse_expectations(markdown, Path(path))

    def test_valid_block_returns_total_and_errors(self):
        md = """
# Doc
Content

```markdownlint-expect
{"total": 1, "errors": [{"line": 2, "rule": "MD001"}]}
```
"""
        total, errors = self._parse(md)
        self.assertEqual(total, 1)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].line, 2)
        self.assertEqual(errors[0].rule, "MD001")

    def test_zero_errors(self):
        md = """
# Doc
```markdownlint-expect
{"total": 0, "errors": []}
```
"""
        total, errors = self._parse(md)
        self.assertEqual(total, 0)
        self.assertEqual(errors, [])

    def test_multiple_errors_same_line(self):
        md = """
x
```markdownlint-expect
{"total": 2, "errors": [{"line": 1, "rule": "A"}, {"line": 1, "rule": "B"}]}
```
"""
        total, errors = self._parse(md)
        self.assertEqual(total, 2)
        self.assertEqual([e.rule for e in errors], ["A", "B"])

    def test_missing_block_raises(self):
        md = "# No expect block"
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("Missing", str(ctx.exception))

    def test_unterminated_block_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 0, "errors": []}
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("Unterminated", str(ctx.exception))

    def test_invalid_json_raises(self):
        md = """
# Doc
```markdownlint-expect
{ total: 0 }
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("Invalid JSON", str(ctx.exception))

    def test_total_not_int_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": "0", "errors": []}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("total", str(ctx.exception))

    def test_total_negative_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": -1, "errors": []}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("total", str(ctx.exception))

    def test_errors_not_list_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 0, "errors": {}}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("errors", str(ctx.exception))

    def test_error_item_not_dict_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": ["not an object"]}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("errors[0]", str(ctx.exception))

    def test_error_missing_line_or_rule_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": [{"line": 1}]}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("errors[0]", str(ctx.exception))

    def test_error_line_below_one_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": [{"line": 0, "rule": "X"}]}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("errors[0]", str(ctx.exception))

    def test_total_mismatch_len_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 2, "errors": [{"line": 1, "rule": "X"}]}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("total", str(ctx.exception))
        self.assertIn("errors.length", str(ctx.exception))

    def test_rule_stripped_of_whitespace(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": [{"line": 1, "rule": "  MD001  "}]}
```
"""
        _, errors = self._parse(md)
        self.assertEqual(errors[0].rule, "MD001")

    def test_optional_column_parsed(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": [{"line": 2, "rule": "ascii-only", "column": 32}]}
```
"""
        _, errors = self._parse(md)
        self.assertEqual(errors[0].line, 2)
        self.assertEqual(errors[0].rule, "ascii-only")
        self.assertEqual(errors[0].column, 32)

    def test_error_column_below_one_raises(self):
        md = """
# Doc
```markdownlint-expect
{"total": 1, "errors": [{"line": 1, "rule": "X", "column": 0}]}
```
"""
        with self.assertRaises(ValueError) as ctx:
            self._parse(md)
        self.assertIn("column", str(ctx.exception))


class TestParseMarkdownlintOutput(unittest.TestCase):
    """Tests for parse_markdownlint_output()."""

    def test_parses_line_and_rule(self):
        # Regex: line:number (optional :col), space, optional "error ", rule, trailing space.
        output = "md_test_files/foo.md:10 MD001/heading-increment \n"
        errors = v.parse_markdownlint_output(output, "md_test_files/foo.md")
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].line, 10)
        self.assertTrue("MD001" in errors[0].rule or "heading" in errors[0].rule)

    def test_ignores_lines_without_file_label(self):
        output = "md_test_files/foo.md:1 X \nother/file.md:2 Y \n"
        errors = v.parse_markdownlint_output(output, "md_test_files/foo.md")
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].line, 1)

    def test_parses_column_format(self):
        # markdownlint can output file:line:column error rule (regex captures column).
        output = "md_test_files/foo.md:5:3 error MD010 \n"
        errors = v.parse_markdownlint_output(output, "md_test_files/foo.md")
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].line, 5)
        self.assertEqual(errors[0].column, 3)

    def test_empty_output_returns_empty_list(self):
        errors = v.parse_markdownlint_output("", "any.md")
        self.assertEqual(errors, [])


class TestToCountMap(unittest.TestCase):
    """Tests for to_count_map()."""

    def test_counts_duplicates(self):
        errors = [
            v.ExpectedError(line=1, rule="A"),
            v.ExpectedError(line=1, rule="A"),
            v.ExpectedError(line=1, rule="B"),
        ]
        m = v.to_count_map(errors)
        self.assertEqual(m[(1, "A", None)], 2)
        self.assertEqual(m[(1, "B", None)], 1)

    def test_empty_list_returns_empty_map(self):
        self.assertEqual(v.to_count_map([]), {})


class TestVerifyFile(unittest.TestCase):
    """Tests for verify_file(): integration (real markdownlint) and exit-code mismatch (mocked)."""

    def test_verify_file_positive_integration(self):
        """Run verify_file on positive.md for real; skip if markdownlint unavailable."""
        path = _REPO_ROOT / "md_test_files" / "positive.md"
        if not path.exists():
            self.skipTest("positive.md fixture not found")
        cmd = v.find_markdownlint_cmd()
        try:
            v.verify_file(cmd, path)
        except (OSError, FileNotFoundError) as e:
            self.skipTest(f"markdownlint not runnable: {e}")

    def test_verify_file_raises_when_exit_code_mismatch(self):
        """Exit code mismatch (expect 0 errors, got non-zero) raises AssertionError."""
        path = _REPO_ROOT / "md_test_files" / "positive.md"
        if not path.exists():
            self.skipTest("positive.md fixture not found")
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": "", "stderr": "error"},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path)
            self.assertIn("exit code", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
