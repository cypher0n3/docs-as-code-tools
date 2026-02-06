# Markdown Test Fixtures

- **positive.md** - Examples that pass all markdown standards. Lint should report 0 errors.
- **negative_*.md** - One file per failing scenario; lint each to verify the expected custom rule(s) fail.

## Negative Fixtures (Custom Rules Only)

| File                                     | Expected custom rule(s)                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| negative_heading_like.md                 | no-heading-like-lines                                     |
| negative_heading_like_variants.md        | no-heading-like-lines (italic, numbered-list variants)    |
| negative_heading_title_case.md           | heading-title-case                                        |
| negative_heading_numbering.md            | heading-numbering (segment, sequence, period, unnumbered) |
| negative_duplicate_headings_normalized.md| no-duplicate-headings-normalized                          |
| negative_ascii_only.md                   | ascii-only                                                |
| negative_anchor_invalid_id.md            | allow-custom-anchors (id not in allowedIdPatterns)        |
| negative_anchor_spec_placement.md        | allow-custom-anchors (spec placement)                     |
| negative_anchor_ref_placement.md         | allow-custom-anchors (ref placement)                      |
| negative_anchor_algo_placement.md        | allow-custom-anchors (algo placement)                     |
| negative_anchor_multiple.md              | allow-custom-anchors (multiple per line)                  |
| negative_inline_html.md                  | allow-custom-anchors (attribute, id pattern, end-of-line) |

Note: some negative fixtures intentionally trigger built-in markdownlint rules in addition to custom rules (e.g. MD031/MD032/MD033), so the test suite can assert multiple errors on specific lines.

## Expectations

Each fixture ends with a `markdownlint-expect` fenced code block containing JSON:

- `total`: expected number of markdownlint errors for this file
- `errors`: list of expected errors (each has `line` and `rule`)

The `make test-markdownlint` target runs `test-scripts/verify_markdownlint_fixtures.py`, which lints each fixture and validates the exact expected errors.

## Linting

- Lint one file:

  `npx markdownlint-cli2 md_test_files/<file>.md`

- Run the full fixture suite:

  `make test-markdownlint`

See `md_test_files/positive.md` and `md_test_files/negative_*.md` for the current expected errors.
