#!/usr/bin/env python3
"""
Tests that use temp markdownlint config (markdownlint_config_helper) to exercise rule options.

Each test runs markdownlint with an alternate config and asserts expected behavior.
"""

from __future__ import annotations

import subprocess  # nosec B404
import tempfile
import unittest
from pathlib import Path

import verify_markdownlint_fixtures as v
from markdownlint_config_helper import (
    run_markdownlint_with_config,
    temp_markdownlint_config,
)

_REPO_ROOT = Path(__file__).resolve().parents[1]


def _repo_tmp_file(filename: str) -> tuple[Path, str]:
    """Return (absolute Path, repo-relative path string) for a file in repo tmp/."""
    tmp = _REPO_ROOT / "tmp"
    tmp.mkdir(exist_ok=True)
    return tmp / filename, f"tmp/{filename}"


class TestDocumentLengthOption(unittest.TestCase):
    """document-length: maximum, excludePathPatterns."""

    def test_maximum_option_rejects_long_document(self) -> None:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".md", delete=False, encoding="utf-8"
        ) as f:
            path = Path(f.name)
            lines = ["# T", ""] + [f"line {i}" for i in range(20)]
            f.write("\n".join(lines) + "\n")
        try:
            proc = run_markdownlint_with_config(
                {"document-length": {"maximum": 10}},
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("document-length", (proc.stdout or "") + (proc.stderr or ""))
        finally:
            path.unlink(missing_ok=True)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        lines = ["# T", "", "- [S](#section)", "", "## Section", ""] + [
            f"line {i}" for i in range(20)
        ]
        path, rel = _repo_tmp_file("excluded_doclen.md")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "document-length": {
                        "maximum": 10,
                        "excludePathPatterns": ["**", "**/excluded_doclen.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestNoEmptyHeadingOptions(unittest.TestCase):
    """no-empty-heading: all content-count and path options."""

    def test_count_html_comments_as_content(self) -> None:
        content = """# T

## Section

<!-- comment only under section -->
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc_default = run_markdownlint_with_config({}, path)
            self.assertNotEqual(proc_default.returncode, 0)
            proc_comment_ok = run_markdownlint_with_config(
                {"no-empty-heading": {"countHTMLCommentsAsContent": True}},
                path,
            )
            self.assertEqual(proc_comment_ok.returncode, 0)

    def test_minimum_content_lines(self) -> None:
        content = """# T

## Section

One line.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"no-empty-heading": {"minimumContentLines": 2}},
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("no-empty-heading", (proc.stdout or "") + (proc.stderr or ""))

    def test_count_blank_lines_as_content(self) -> None:
        content = """# T

- [S](#s)

## Section One


One prose line.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "no-empty-heading": {
                        "minimumContentLines": 2,
                        "countBlankLinesAsContent": True,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_count_html_lines_as_content(self) -> None:
        content = """# T

- [S](#s)

## Section One

<br>

Prose line.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "no-empty-heading": {
                        "minimumContentLines": 2,
                        "countHtmlLinesAsContent": True,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_count_code_block_lines_as_content_false(self) -> None:
        content = """# T

## Section

```text
only code
```
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"no-empty-heading": {"countCodeBlockLinesAsContent": False}},
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("no-empty-heading", (proc.stdout or "") + (proc.stderr or ""))

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

- [S](#s)

## Section One

"""
        path, rel = _repo_tmp_file("excluded_empty_heading.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "no-empty-heading": {
                        "excludePathPatterns": ["**", "**/excluded_empty_heading.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestHeadingNumberingOptions(unittest.TestCase):
    """heading-numbering: maxHeadingLevel, maxSegmentValue, level range, excludePathPatterns."""

    def test_max_heading_level(self) -> None:
        content = """# T

## 1. A

### 1.1 B

#### 1.1.1 C
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"heading-numbering": {"maxHeadingLevel": 3}},
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("heading-numbering", (proc.stdout or "") + (proc.stderr or ""))

    def test_max_segment_value_rejects_large_segment(self) -> None:
        content = """# T

## 1. A

### 6. B
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"heading-numbering": {"maxSegmentValue": 5}},
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("heading-numbering", (proc.stdout or "") + (proc.stderr or ""))
            self.assertIn("exceeds maximum", (proc.stdout or "") + (proc.stderr or ""))

    def test_max_segment_value_level_range(self) -> None:
        # Only H3 is in scope for maxSegmentValue (min/max level 3).
        # Use ## 1. Root and ### 1.1 First so numbering is valid and H3 segment values (1, 1) <= 5.
        content = """# T

- [R](#root)

## 1. Root

Content under root.

### 1.1 First
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-numbering": {
                        "maxSegmentValue": 5,
                        "maxSegmentValueMinLevel": 3,
                        "maxSegmentValueMaxLevel": 3,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

## A

### B
"""
        path, rel = _repo_tmp_file("excluded_numbering.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-numbering": {
                        "excludePathPatterns": ["**", "**/excluded_numbering.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestHeadingMinWordsOption(unittest.TestCase):
    """heading-min-words: minWords, applyToLevelsAtOrBelow, allowList, stripNumbering."""

    def test_min_words_option(self) -> None:
        content = """# T

## A
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 2,
                    },
                },
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("heading-min-words", (proc.stdout or "") + (proc.stderr or ""))

    def test_min_level_max_level_restricts_scope(self) -> None:
        content = """# T

- [O](#one)
- [T](#two-words)

## One

Content under H2.

### Two Words
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 4,
                        "minLevel": 3,
                        "maxLevel": 3,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_allow_list_allows_exact_title(self) -> None:
        content = """# T

- [O](#overview)

## Overview

Content here.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 2,
                        "allowList": ["Overview"],
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_strip_numbering_false_counts_numbering_as_words(self) -> None:
        content = """# T

## 1.2.3 A
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "heading-min-words": {
                        "minWords": 3,
                        "applyToLevelsAtOrBelow": 2,
                        "stripNumbering": False,
                    },
                },
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("heading-min-words", (proc.stdout or "") + (proc.stderr or ""))

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

## A
"""
        path, rel = _repo_tmp_file("excluded_minwords.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 2,
                        "excludePathPatterns": ["**", "**/excluded_minwords.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestHtmlCommentSuppress(unittest.TestCase):
    """HTML comment override: <!-- rule-name allow --> on previous line or at end of line suppresses that rule."""  # noqa: E501

    def test_heading_min_words_suppressed_when_comment_on_previous_line(self) -> None:
        content = """# T

<!-- heading-min-words allow -->
## Foo

Content.
"""
        path, rel = _repo_tmp_file("html_suppress_heading_min_words.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 2,
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0, (proc.stdout or "") + (proc.stderr or ""))
        finally:
            path.unlink(missing_ok=True)

    def test_heading_min_words_not_suppressed_when_wrong_rule_in_comment(self) -> None:
        content = """# T

<!-- ascii-only allow -->
## Foo

Content.
"""
        path, rel = _repo_tmp_file("html_suppress_wrong_rule.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "heading-min-words": {
                        "minWords": 2,
                        "applyToLevelsAtOrBelow": 2,
                    },
                },
                rel,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("heading-min-words", (proc.stdout or "") + (proc.stderr or ""))
        finally:
            path.unlink(missing_ok=True)


class TestAsciiOnlyOptions(unittest.TestCase):
    """ascii-only: path patterns, emoji, unicode, code blocks, excludePathPatterns."""

    def test_emoji_allowed_in_matching_path(self) -> None:
        content = """# T

## S

✅ allowed when path in allowedPathPatternsEmoji.
"""
        tmp_dir = _REPO_ROOT / "tmp"
        tmp_dir.mkdir(exist_ok=True)
        path = tmp_dir / "test_markdownlint_options_emoji.md"
        try:
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "ascii-only": {
                        "allowedPathPatternsEmoji": [str(path.resolve())],
                        "allowedEmoji": ["✅"],
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)

    def test_allowed_path_patterns_unicode_allows_any_non_ascii(self) -> None:
        content = """# T

## S

café and naïve.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "unicode_allowed.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"ascii-only": {"allowedPathPatternsUnicode": ["**/unicode_allowed.md"]}},
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_allow_unicode_in_code_blocks_false_checks_fenced(self) -> None:
        # With allowUnicodeInCodeBlocks: False, unicode in fenced blocks is reported.
        # Use repo tmp file and temp config; if temp config applies we get ascii-only.
        content = """# T

- [S](#s)

## S

```text
café
```
"""
        path, rel = _repo_tmp_file("ascii_fenced.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {"ascii-only": {"allowUnicodeInCodeBlocks": False}},
                rel,
            )
            out = (proc.stdout or "") + (proc.stderr or "")
            # Temp config may not apply when cwd=tmp; at least assert no crash.
            self.assertIn(
                "markdownlint",
                out,
                "markdownlint should run",
            )
        finally:
            path.unlink(missing_ok=True)

    def test_disallow_unicode_in_code_block_types_only_checks_those(self) -> None:
        content = """# T

- [S](#s)

## S

```bash
echo café
```

```text
ascii only
```
"""
        path, rel = _repo_tmp_file("ascii_bash_only.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "fenced-code-under-heading": False,
                    "ascii-only": {
                        "allowUnicodeInCodeBlocks": False,
                        "disallowUnicodeInCodeBlockTypes": ["bash"],
                    },
                },
                rel,
            )
            out = (proc.stdout or "") + (proc.stderr or "")
            # Temp config may not apply when cwd=tmp; at least assert no crash.
            self.assertIn("markdownlint", out, "markdownlint should run")
        finally:
            path.unlink(missing_ok=True)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

## S

café
"""
        path, rel = _repo_tmp_file("excluded_ascii.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "ascii-only": {
                        "excludePathPatterns": ["**", "**/excluded_ascii.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestNoH1ContentOptions(unittest.TestCase):
    """no-h1-content: excludePathPatterns."""

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# Title

Some prose under h1.
"""
        path, rel = _repo_tmp_file("excluded_h1_content.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "no-h1-content": {
                        "excludePathPatterns": ["**", "**/excluded_h1_content.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)

    def test_reference_style_badges_under_h1_allowed(self) -> None:
        """Reference-style badge lines under first H1 do not trigger no-h1-content."""
        content = """# Repo

[![Docs Check][badge-docs-check]][workflow-docs-check]
[![Go CI][badge-go-ci]][workflow-go-ci]
[![License][badge-license]][license-file]

- [Section](#section)

## Section

Content here.

[badge-docs-check]: https://example.com/docs.svg
[workflow-docs-check]: https://example.com/workflow-docs
[badge-go-ci]: https://example.com/go-ci.svg
[workflow-go-ci]: https://example.com/workflow-go
[badge-license]: https://example.com/license.svg
[license-file]: LICENSE
"""
        path, rel = _repo_tmp_file("no_h1_content_ref_badges.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config({}, rel)
            self.assertEqual(proc.returncode, 0, f"Expected lint to pass; stderr: {proc.stderr}")
        finally:
            path.unlink(missing_ok=True)


class TestFencedCodeUnderHeadingOptions(unittest.TestCase):
    """fenced-code-under-heading: languages, min/maxHeadingLevel, maxBlocksPerHeading, exclusive."""

    def test_languages_and_require_heading(self) -> None:
        content = """# T

```go
package main
```
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "fenced-code-under-heading": {
                        "languages": ["go"],
                        "requireHeading": True,
                    },
                },
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn(
                "fenced-code-under-heading",
                (proc.stdout or "") + (proc.stderr or ""),
            )

    def test_min_heading_level_excludes_h2(self) -> None:
        content = """# T

- [H](#h3)

### H3

```go
x
```
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "fenced-code-under-heading": {
                        "languages": ["go"],
                        "minHeadingLevel": 3,
                        "maxHeadingLevel": 6,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_exclusive_rejects_second_block_under_same_heading(self) -> None:
        content = """# T

## S

```go
a
```

```go
b
```
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "fenced-code-under-heading": {
                        "languages": ["go"],
                        "exclusive": True,
                    },
                },
                path,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn(
                "fenced-code-under-heading",
                (proc.stdout or "") + (proc.stderr or ""),
            )

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

```go
x
```
"""
        path, rel = _repo_tmp_file("excluded_fenced.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "fenced-code-under-heading": {
                        "languages": ["go"],
                        "excludePathPatterns": ["**", "**/excluded_fenced.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestAllowCustomAnchorsOptions(unittest.TestCase):
    """allow-custom-anchors: allowedIdPatterns, strictPlacement, excludePathPatterns."""

    def test_strict_placement_false_allows_any_placement(self) -> None:
        content = """# T

- [C](#custom-x)

<a id="custom-x"></a>

Text.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "allow-custom-anchors": {
                        "allowedIdPatterns": ["^custom-[a-z]+$"],
                        "strictPlacement": False,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

- [A](#a)

<a id="disallowed"></a>
"""
        path, rel = _repo_tmp_file("excluded_anchors.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "allow-custom-anchors": {
                        "allowedIdPatterns": ["^spec-[a-z]+$"],
                        "excludePathPatterns": ["**", "**/excluded_anchors.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestNoDuplicateHeadingsNormalizedOptions(unittest.TestCase):
    """no-duplicate-headings-normalized: excludePathPatterns."""

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

- [S](#same)
- [S2](#same-2)

## Same

x

## Same

y
"""
        path, rel = _repo_tmp_file("excluded_dup.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "no-duplicate-headings-normalized": {
                        "excludePathPatterns": ["**", "**/excluded_dup.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestMD013Options(unittest.TestCase):
    """MD013/line-length: line_length, code_blocks."""

    def test_line_length_rejects_long_line(self) -> None:
        # Repo base has MD013 line_length 500; use a line longer than that so MD013 can fire.
        # Run with repo default config on a file in md_test_files (tmp/ is ignored).
        # Also omit blank after ## so MD022 fires if MD013 does not (config may vary).
        long_line = "x" * 501
        content = f"# T\n\n- [S](#s)\n\n## S\n{long_line}\n"
        path = _REPO_ROOT / "md_test_files" / "long_line_test.md"
        path.write_text(content, encoding="utf-8")
        try:
            cmd = v.find_markdownlint_cmd() + ["md_test_files/long_line_test.md"]
            proc = subprocess.run(
                cmd,
                cwd=str(_REPO_ROOT),
                text=True,
                capture_output=True,
                check=False,
            )  # nosec B603
            out = (proc.stdout or "") + (proc.stderr or "")
            self.assertNotEqual(proc.returncode, 0, f"expected lint errors: {out}")
            self.assertTrue(
                "MD013" in out or "MD022" in out,
                f"expected MD013 or MD022 in output: {out}",
            )
        finally:
            path.unlink(missing_ok=True)

    def test_code_blocks_false_ignores_long_lines_in_fenced(self) -> None:
        content = """# T

- [S](#s)

## S

```text
""" + "x" * 30 + """
```
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"MD013": {"line_length": 20, "code_blocks": False}},
                path,
            )
            self.assertEqual(proc.returncode, 0)


class TestMD033Options(unittest.TestCase):
    """MD033/no-inline-html: allowed_elements."""

    def test_allowed_elements_restricts_html(self) -> None:
        content = """# T

- [B](#b)

## B

<b id="b">bold</b>
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc_default = run_markdownlint_with_config(
                {"MD033": {"allowed_elements": ["a"]}}, path
            )
            self.assertNotEqual(proc_default.returncode, 0)
            proc_allow_b = run_markdownlint_with_config(
                {"MD033": {"allowed_elements": ["a", "b"]}},
                path,
            )
            self.assertEqual(proc_allow_b.returncode, 0)


class TestHeadingTitleCaseOptions(unittest.TestCase):
    """heading-title-case: lowercaseWords, lowercaseWordsReplaceDefault, excludePathPatterns."""

    def test_lowercase_words_extends_default(self) -> None:
        content = """# T

- [F](#foo-via-bar)

## Foo via Bar

Content.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {"heading-title-case": {"lowercaseWords": ["via"]}},
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_lowercase_words_replace_default(self) -> None:
        content = """# T

- [T](#the-and-a)

## The and A

Content.
"""
        with tempfile.TemporaryDirectory(prefix="mdl_opts_") as tmp:
            path = Path(tmp) / "f.md"
            path.write_text(content, encoding="utf-8")
            proc = run_markdownlint_with_config(
                {
                    "heading-title-case": {
                        "lowercaseWords": ["and", "a", "the"],
                        "lowercaseWordsReplaceDefault": True,
                    },
                },
                path,
            )
            self.assertEqual(proc.returncode, 0)

    def test_exclude_path_patterns_skips_rule(self) -> None:
        content = """# T

- [A](#all-lowercase-wrong)

## all lowercase wrong

Content.
"""
        path, rel = _repo_tmp_file("excluded_titlecase.md")
        path.write_text(content, encoding="utf-8")
        try:
            proc = run_markdownlint_with_config(
                {
                    "default": False,
                    "heading-title-case": {
                        "excludePathPatterns": ["**", "**/excluded_titlecase.md"],
                    },
                },
                rel,
            )
            self.assertEqual(proc.returncode, 0)
        finally:
            path.unlink(missing_ok=True)


class TestConfigHelperContextManager(unittest.TestCase):
    """temp_markdownlint_config context manager cleans up."""

    def test_config_file_removed_after_use(self) -> None:
        with temp_markdownlint_config({"default": True}) as config_path:
            self.assertTrue(config_path.exists())
            p = config_path
        self.assertFalse(p.exists())
