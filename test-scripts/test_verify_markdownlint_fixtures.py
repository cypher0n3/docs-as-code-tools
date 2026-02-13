#!/usr/bin/env python3
"""
Unit tests for verify_markdownlint_fixtures.py.

Tests parsing of expectations from YAML/data, markdownlint output parsing,
and multiset comparison. Does not require markdownlint-cli2 except for
integration-style tests (skipped when unavailable).
"""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

import verify_markdownlint_fixtures as v

_REPO_ROOT = Path(__file__).resolve().parents[1]
_MD_DIR = _REPO_ROOT / "md_test_files"
_EXPECT_PATH = _MD_DIR / "expected_errors.yml"


def _fixture_files():
    """Fixture list from verifier; tests rely on expected_errors.yml + list_fixture_files()."""
    return v.list_fixture_files()


def _first_fixture_path():
    """First fixture path for tests that need one; None if no fixtures."""
    files = _fixture_files()
    return files[0] if files else None


def _expectations_from_yml():
    """Load expected_errors.yml; return dict or None if missing."""
    if not _EXPECT_PATH.exists():
        return None
    return v.load_expected_errors(_EXPECT_PATH)


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

    def test_returns_npx_when_local_missing(self):
        """When node_modules binary does not exist, returns npx command."""
        with patch.object(v, "repo_root", return_value=Path("/nonexistent_repo")):
            cmd = v.find_markdownlint_cmd()
        self.assertEqual(cmd, ["npx", "markdownlint-cli2"])


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
        self.assertTrue(
            files[0].name.startswith("positive_"),
            f"first fixture should be positive_*.md, got {files[0].name}",
        )

    def test_rest_are_negative_md(self):
        files = v.list_fixture_files()
        seen_negative = False
        for f in files:
            if f.name.startswith("negative_"):
                seen_negative = True
                self.assertTrue(f.name.endswith(".md"))
            else:
                self.assertTrue(
                    f.name.startswith("positive_"),
                    f"fixture should be positive_*.md or negative_*.md, got {f.name}",
                )
                self.assertFalse(
                    seen_negative,
                    f"positive fixture {f.name} must not appear after a negative",
                )


class TestLoadExpectedErrors(unittest.TestCase):
    """Tests for load_expected_errors()."""

    def test_missing_file_raises(self):
        with self.assertRaises(FileNotFoundError):
            v.load_expected_errors(Path("/nonexistent/expected_errors.yml"))

    def test_valid_yaml_returns_dict(self):
        if not _EXPECT_PATH.exists():
            self.skipTest("expected_errors.yml not found")
        data = v.load_expected_errors(_EXPECT_PATH)
        self.assertIsInstance(data, dict)
        fixture_names = {p.name for p in _fixture_files()}
        self.assertEqual(
            set(data.keys()),
            fixture_names,
            "expected_errors.yml keys must match list_fixture_files()",
        )

    def test_invalid_yaml_raises(self):
        import tempfile
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
            f.write("not: valid: yaml: [")
            f.flush()
            try:
                with self.assertRaises(ValueError) as ctx:
                    v.load_expected_errors(Path(f.name))
                self.assertIn("Invalid YAML", str(ctx.exception))
            finally:
                Path(f.name).unlink(missing_ok=True)

    def test_yaml_not_dict_raises(self):
        import tempfile
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
            f.write("- list\n- not dict\n")
            f.flush()
            try:
                with self.assertRaises(ValueError) as ctx:
                    v.load_expected_errors(Path(f.name))
                self.assertIn("must be a YAML object", str(ctx.exception))
            finally:
                Path(f.name).unlink(missing_ok=True)


class TestParseExpectationsFromData(unittest.TestCase):
    """Tests for parse_expectations_from_data()."""

    def _parse(self, data: dict, path: str = "test.md") -> tuple:
        return v.parse_expectations_from_data(data, Path(path))

    def test_valid_data_returns_total_and_errors(self):
        data = {"errors": [{"line": 2, "rule": "MD001"}]}
        total, errors = self._parse(data)
        self.assertEqual(total, 1)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].line, 2)
        self.assertEqual(errors[0].rule, "MD001")

    def test_zero_errors(self):
        data = {"errors": []}
        total, errors = self._parse(data)
        self.assertEqual(total, 0)
        self.assertEqual(errors, [])

    def test_multiple_errors_same_line(self):
        data = {
            "errors": [{"line": 1, "rule": "A"}, {"line": 1, "rule": "B"}],
        }
        total, errors = self._parse(data)
        self.assertEqual(total, 2)
        self.assertEqual([e.rule for e in errors], ["A", "B"])

    def test_data_not_dict_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse([])
        self.assertIn("must be an object", str(ctx.exception))

    def test_errors_not_list_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({"errors": {}})
        self.assertIn("errors", str(ctx.exception))

    def test_error_item_not_dict_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({"errors": ["not an object"]})
        self.assertIn("errors[0]", str(ctx.exception))

    def test_error_missing_line_or_rule_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({"errors": [{"line": 1}]})
        self.assertIn("errors[0]", str(ctx.exception))

    def test_error_line_below_one_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({"errors": [{"line": 0, "rule": "X"}]})
        self.assertIn("errors[0]", str(ctx.exception))

    def test_rule_stripped_of_whitespace(self):
        data = {"errors": [{"line": 1, "rule": "  MD001  "}]}
        _, errors = self._parse(data)
        self.assertEqual(errors[0].rule, "MD001")

    def test_optional_column_parsed(self):
        data = {
            "errors": [{"line": 2, "rule": "ascii-only", "column": 32}],
        }
        _, errors = self._parse(data)
        self.assertEqual(errors[0].line, 2)
        self.assertEqual(errors[0].rule, "ascii-only")
        self.assertEqual(errors[0].column, 32)

    def test_error_column_below_one_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({"errors": [{"line": 1, "rule": "X", "column": 0}]})
        self.assertIn("column", str(ctx.exception))

    def test_message_contains_parsed(self):
        data = {
            "errors": [
                {"line": 1, "rule": "X", "message_contains": "expected substring"},
            ],
        }
        _, errors = self._parse(data)
        self.assertEqual(errors[0].message_contains, "expected substring")

    def test_message_contains_not_string_raises(self):
        with self.assertRaises(ValueError) as ctx:
            self._parse({
                "errors": [{"line": 1, "rule": "X", "message_contains": 123}],
            })
        self.assertIn("message_contains", str(ctx.exception))


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

    def test_parses_message(self):
        output = (
            'md_test_files/foo.md:7:4 heading-title-case '
            '[Word "getting" should be capitalized.]'
        )
        errors = v.parse_markdownlint_output(output, "md_test_files/foo.md")
        self.assertEqual(len(errors), 1)
        self.assertIn("getting", errors[0].message)
        self.assertIn("capitalized", errors[0].message)

    def test_empty_output_returns_empty_list(self):
        errors = v.parse_markdownlint_output("", "any.md")
        self.assertEqual(errors, [])

    def test_skips_line_with_prefix_but_no_regex_match(self):
        """Lines starting with file_label but not matching error regex are skipped."""
        output = "md_test_files/foo.md: not an error line format\n"
        errors = v.parse_markdownlint_output(output, "md_test_files/foo.md")
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

    def test_includes_column_in_key(self):
        errors = [
            v.ExpectedError(line=1, rule="R", column=5),
            v.ExpectedError(line=1, rule="R", column=10),
        ]
        m = v.to_count_map(errors)
        self.assertEqual(m[(1, "R", 5)], 1)
        self.assertEqual(m[(1, "R", 10)], 1)


class TestVerifyFile(unittest.TestCase):
    """Tests for verify_file(): integration (real markdownlint) and exit-code mismatch (mocked)."""

    def test_verify_file_positive_integration(self):
        """Run verify_file on first fixture for real; skip if markdownlint unavailable."""
        path = _first_fixture_path()
        if path is None or not _EXPECT_PATH.exists():
            self.skipTest("fixtures or expected_errors.yml not found")
        cmd = v.find_markdownlint_cmd()
        expectations = _expectations_from_yml()
        try:
            v.verify_file(cmd, path, expectations)
        except (OSError, FileNotFoundError) as e:
            self.skipTest(f"markdownlint not runnable: {e}")

    def test_verify_document_length_generated_fixture(self):
        """Generate a 1501-line fixture, verify document-length error, then remove file."""
        path = _MD_DIR / "negative_document_length.md"
        if not _EXPECT_PATH.exists():
            self.skipTest("expected_errors.yml not found")
        expectations = _expectations_from_yml()
        if path.name not in expectations:
            self.skipTest("negative_document_length.md not in expected_errors.yml")
        v.ensure_long_document_fixture(path)
        try:
            cmd = v.find_markdownlint_cmd()
            try:
                v.verify_file(cmd, path, expectations)
            except (OSError, FileNotFoundError) as e:
                self.skipTest(f"markdownlint not runnable: {e}")
        finally:
            path.unlink(missing_ok=True)

    def test_verify_file_raises_when_exit_code_mismatch(self):
        """Exit code mismatch (expect 0 errors, got non-zero) raises AssertionError."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {path.name: {"errors": []}}
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": "", "stderr": "error"},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("exit code", str(ctx.exception))

    def test_verify_file_raises_when_message_contains_mismatch(self):
        """When message_contains is specified but actual message does not contain it."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {
            path.name: {
                "errors": [
                    {
                        "line": 1,
                        "rule": "MD001",
                        "message_contains": "this string is not in the output",
                    },
                ],
            },
        }
        output = f"md_test_files/{path.name}:1 MD001 Some other message\n"
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": output, "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("message", str(ctx.exception).lower())
            self.assertIn("message_contains", str(ctx.exception))

    def test_verify_file_raises_when_no_expectations_for_file(self):
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        with self.assertRaises(ValueError) as ctx:
            v.verify_file(["mdl"], path, {})
        self.assertIn("No expectations", str(ctx.exception))

    def test_verify_file_raises_when_expect_errors_got_zero_exit(self):
        """Expect non-zero errors but subprocess returns 0."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {path.name: {"errors": [{"line": 1, "rule": "X"}]}}
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 0, "stdout": "", "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("exit code", str(ctx.exception))

    def test_verify_file_raises_when_error_count_mismatch(self):
        """Expected 1 error but got 2 in output."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {path.name: {"errors": [{"line": 1, "rule": "X"}]}}
        output = (
            f"md_test_files/{path.name}:1 X msg1\n"
            f"md_test_files/{path.name}:2 X msg2\n"
        )
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": output, "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("error count", str(ctx.exception))

    def test_verify_file_raises_when_line_rule_count_mismatch(self):
        """Expected 2 errors on same line/rule but got 1 at line 1 and 1 at line 2."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {
            path.name: {
                "errors": [
                    {"line": 1, "rule": "X"},
                    {"line": 1, "rule": "X"},
                ],
            },
        }
        output = (
            f"md_test_files/{path.name}:1 X msg1\n"
            f"md_test_files/{path.name}:2 X msg2\n"
        )
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": output, "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("expected 2, got 1", str(ctx.exception))

    def test_verify_file_raises_when_column_count_mismatch(self):
        """Expected 2 errors at column 5 but actual has one at 5 and one at 10."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {
            path.name: {
                "errors": [
                    {"line": 1, "rule": "X", "column": 5},
                    {"line": 1, "rule": "X", "column": 5},
                ],
            },
        }
        output = (
            f"md_test_files/{path.name}:1:5 X msg1\n"
            f"md_test_files/{path.name}:1:10 X msg2\n"
        )
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": output, "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("column", str(ctx.exception))

    def test_verify_file_raises_when_expected_line_rule_not_in_actual(self):
        """Expected at line 99 rule X but actual has only line 1 (line/rule multiset mismatch)."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {
            path.name: {
                "errors": [
                    {"line": 99, "rule": "X", "message_contains": "needle"},
                ],
            },
        }
        output = f"md_test_files/{path.name}:1 X msg\n"
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": output, "stderr": ""},
            )()
            with self.assertRaises(AssertionError) as ctx:
                v.verify_file(["markdownlint-cli2"], path, expectations)
            self.assertIn("expected 0, got 1", str(ctx.exception))

    def test_verify_file_combines_stdout_and_stderr(self):
        """verify_file uses combined stdout+stderr for parsing."""
        path = _first_fixture_path()
        if path is None:
            self.skipTest("no fixtures found")
        expectations = {path.name: {"errors": [{"line": 1, "rule": "X"}]}}
        line_out = f"md_test_files/{path.name}:1 X msg\n"
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": line_out, "stderr": ""},
            )()
            v.verify_file(["markdownlint-cli2"], path, expectations)
        with patch("verify_markdownlint_fixtures.subprocess.run") as run:
            run.return_value = type(
                "Result",
                (),
                {"returncode": 1, "stdout": "", "stderr": line_out},
            )()
            v.verify_file(["markdownlint-cli2"], path, expectations)


class TestMain(unittest.TestCase):
    """Tests for main()."""

    def test_main_returns_zero_when_all_pass(self):
        fixture_list = _fixture_files()
        expectations = _expectations_from_yml()
        if not fixture_list or expectations is None:
            self.skipTest("fixtures or expected_errors.yml not found")
        with patch("sys.argv", ["prog"]):
            with patch.object(v, "find_markdownlint_cmd", return_value=["markdownlint-cli2"]):
                with patch.object(v, "list_fixture_files", return_value=fixture_list):
                    with patch.object(v, "load_expected_errors", return_value=expectations):
                        with patch.object(v, "verify_file"):
                            result = v.main()
        self.assertEqual(result, 0)

    def test_main_prints_success_message(self):
        fixture_list = _fixture_files()
        expectations = _expectations_from_yml()
        if not fixture_list or expectations is None:
            self.skipTest("fixtures or expected_errors.yml not found")
        with patch("sys.argv", ["prog"]):
            with patch.object(v, "find_markdownlint_cmd", return_value=["markdownlint-cli2"]):
                with patch.object(v, "list_fixture_files", return_value=fixture_list[:1]):
                    with patch.object(v, "load_expected_errors", return_value=expectations):
                        with patch.object(v, "verify_file"):
                            with patch("sys.stdout") as mock_stdout:
                                self.assertEqual(v.main(), 0)
                            mock_stdout.write.assert_called()
                            out = "".join(c[0][0] for c in mock_stdout.write.call_args_list)
                            self.assertIn("All markdownlint", out)

    def test_main_returns_one_on_failure(self):
        fixture_list = _fixture_files()
        expectations = _expectations_from_yml()
        if not fixture_list or expectations is None:
            self.skipTest("fixtures or expected_errors.yml not found")
        with patch("sys.argv", ["prog"]):
            with patch.object(v, "find_markdownlint_cmd", return_value=["markdownlint-cli2"]):
                with patch.object(v, "list_fixture_files", return_value=fixture_list[:1]):
                    with patch.object(v, "load_expected_errors", return_value=expectations):
                        with patch.object(v, "verify_file", side_effect=AssertionError("fail")):
                            result = v.main()
        self.assertEqual(result, 1)

    def test_main_verbose_writes_per_fixture(self):
        fixture_list = _fixture_files()
        expectations = _expectations_from_yml()
        if not fixture_list or expectations is None:
            self.skipTest("fixtures or expected_errors.yml not found")
        with patch.object(v, "find_markdownlint_cmd", return_value=["markdownlint-cli2"]):
            with patch.object(v, "list_fixture_files", return_value=fixture_list[:1]):
                with patch.object(v, "load_expected_errors", return_value=expectations):
                    with patch.object(v, "verify_file"):
                        with patch("sys.argv", ["prog", "--verbose"]):
                            with patch("sys.stderr") as mock_stderr:
                                v.main()
                        self.assertGreater(mock_stderr.write.call_count, 0)
                        calls = "".join(c[0][0] for c in mock_stderr.write.call_args_list)
                        self.assertIn("Verifying", calls)


if __name__ == "__main__":
    unittest.main()
