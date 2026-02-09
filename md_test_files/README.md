# Markdown Test Fixtures

[![Python tests](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml)

- [Fixtures Overview](#fixtures-overview)
- [Negative Fixtures (Custom Rules Only)](#negative-fixtures-custom-rules-only)
- [Expectations](#expectations)
- [Linting](#linting)

## Fixtures Overview

- `**positive_general.md**` - Examples that pass all markdown standards, including no-empty-heading:
  section with only `<!-- no-empty-heading allow -->` on its own line, and section with other HTML comments plus that comment on its own line.
  Lint should report 0 errors.
- `**positive_general_index.md**` - Index-style page (filename matches `**/*_index.md`); excluded from no-empty-heading so empty H2 sections are allowed; passes with 0 errors.
- `**positive_heading_numbering_zero.md**` - 0-indexed H2 numbering (## 0., 1., 2. and subsections); passes with 0 errors.
- `**negative_*.md**` - One file per failing scenario; lint each to verify the expected custom rule(s) fail.

## Negative Fixtures (Custom Rules Only)

Each item: **filename** - custom rule(s) that fail; sub-bullet - what the fixture exercises.

- **negative_anchor_algo_placement.md** - allow-custom-anchors
  - Anchor placement for algo/spec patterns (headingMatch, lineMatch, requireAfter, etc.).
- **negative_anchor_invalid_id.md** - allow-custom-anchors
  - Anchor id does not match any allowedIdPatterns.
- **negative_anchor_multiple.md** - allow-custom-anchors
  - Multiple anchors on the same line (one-per-line).
- **negative_anchor_ref_placement.md** - allow-custom-anchors
  - Ref-pattern placement (e.g. requireAfter blank/fencedBlock).
- **negative_anchor_spec_placement.md** - allow-custom-anchors
  - Spec-pattern placement (lineMatch, anchorImmediatelyAfterHeading).
- **negative_ascii_only.md** - ascii-only
  - Non-ASCII in prose (arrows, quotes, etc.) where not allowlisted.
- **negative_duplicate_headings_normalized.md** - no-duplicate-headings-normalized
  - Duplicate heading titles after normalizing (and heading-numbering sibling/sequence).
- **negative_heading_like.md** - no-heading-like-lines
  - Lines that look like headings (e.g. `**Text:**`, `1. **Text**`) but are not ATX headings.
- **negative_heading_numbering.md** - heading-numbering
  - Segment count, sequence, period style, unnumbered sibling, zero-indexed violations.
- **negative_heading_title_case.md** - heading-title-case
  - AP-style capitalization (lowercase/middle words, hyphenated compounds, etc.).
- **negative_inline_html.md** - allow-custom-anchors
  - Inline HTML (MD033), anchor id/format, end-of-line content.
- **negative_no_empty_heading.md** - no-empty-heading
  - Headings with no direct content (content under subheadings does not count); empty H2/H3 or H2 at end; wrong HTML comment does not suppress; suppress comment on same line as another comment does not suppress; wrong-format comment (e.g. colon) does not suppress.
    By default blank/HTML-comment/HTML-tag lines do not count; code block lines do count (configurable).
- **negative_no_h1_content.md** - no-h1-content
  - Prose under the first h1 (only TOC-style content allowed there).

Note: some negative fixtures intentionally trigger built-in markdownlint rules in addition to custom rules (e.g. MD031/MD032/MD033), so the test suite can assert multiple errors on specific lines.

## Expectations

Expected errors are defined in **expected_errors.yml** (one entry per fixture, keyed by filename). Each entry has:

- **errors**: list of expected errors. Each error has:
  - **line** (required), **rule** (required)
  - **column** (optional) - for rules that report at character level (e.g. ascii-only, heading-title-case)
  - **message_contains** (optional) - substring that must appear in the rule's message

Total expected count is the length of the errors list. The `make test-markdownlint` target runs `test-scripts/verify_markdownlint_fixtures.py`, which lints each fixture and validates output against this file.

## Linting

- Lint one file:

  `npx markdownlint-cli2 md_test_files/<file>.md`

- Run the full fixture suite:

  `make test-markdownlint`

See **expected_errors.yml** for the expected errors per fixture.
