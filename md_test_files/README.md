# Markdown Test Fixtures

- **positive_general.md** - Examples that pass all markdown standards. Lint should report 0 errors.
- **positive_heading_numbering_zero.md** - 0-indexed H2 numbering (## 0., 1., 2. and subsections); passes with 0 errors.
- **negative_*.md** - One file per failing scenario; lint each to verify the expected custom rule(s) fail.

## Negative Fixtures (Custom Rules Only)

| File                                      | Expected custom rule(s)                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| negative_anchor_algo_placement.md         | allow-custom-anchors (algo placement)                                   |
| negative_anchor_invalid_id.md             | allow-custom-anchors (id not in allowedIdPatterns)                      |
| negative_anchor_multiple.md               | allow-custom-anchors (multiple per line)                                |
| negative_anchor_ref_placement.md          | allow-custom-anchors (ref placement)                                    |
| negative_anchor_spec_placement.md         | allow-custom-anchors (spec placement)                                   |
| negative_ascii_only.md                    | ascii-only                                                              |
| negative_duplicate_headings_normalized.md | no-duplicate-headings-normalized                                        |
| negative_heading_like.md                  | no-heading-like-lines                                                   |
| negative_heading_numbering.md             | heading-numbering (segment, sequence, period, unnumbered, zero-indexed) |
| negative_heading_title_case.md            | heading-title-case                                                      |
| negative_inline_html.md                   | allow-custom-anchors (attribute, id pattern, end-of-line)               |

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
