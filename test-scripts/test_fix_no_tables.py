#!/usr/bin/env python3
"""
Functional test for no-tables fixInfo: with convert-to list, run markdownlint --fix
and assert the table is converted to a list.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v
from markdownlint_config_helper import run_markdownlint_with_config

_REPO_ROOT = Path(__file__).resolve().parents[1]
RULE = "no-tables"


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


class TestFixNoTables(unittest.TestCase):
    """Test that no-tables with convert-to list applies fix and converts table to list."""

    def test_fix_converts_table_to_list(self) -> None:
        content_before = """# Doc

## Table

| heading 1 | heading 2 | heading 3 |
| --- | --- | --- |
| h1c1 content | h2c1 content | h3c1 content |
| h1c2 content | h2c2 content | h3c2 content |
"""
        content_after = """# Doc

## Table

- **heading 1:** h1c1 content
  - heading 2: h2c1 content
  - heading 3: h3c1 content
- **heading 1:** h1c2 content
  - heading 2: h2c2 content
  - heading 3: h3c2 content
"""
        overrides = {"no-tables": {"convert-to": "list"}}
        with tempfile.TemporaryDirectory(prefix="fix_no_tables_") as tmp:
            path = Path(tmp) / "test.md"
            path.write_text(content_before, encoding="utf-8")

            proc = _run_markdownlint(path, fix=False, config_overrides=overrides)
            self.assertNotEqual(proc.returncode, 0, "expected lint errors before fix")
            combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
            self.assertIn(RULE, combined, f"expected {RULE} in output")

            proc_fix = _run_markdownlint(path, fix=True, config_overrides=overrides)
            self.assertEqual(proc_fix.returncode, 0, f"--fix should succeed: {proc_fix.stderr}")

            actual = path.read_text(encoding="utf-8")
            self.assertEqual(
                actual,
                content_after,
                "file content after --fix should be table converted to list",
            )
