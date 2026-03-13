# Positive Fixture: No Heading-Like Lines

<!-- Lint: `npx markdownlint-cli2 md_test_files/positive_heading_like.md` -->
<!-- Expect: 0 errors (proper ATX headings; short title-case colon only flagged when prose follows). -->

## Real Headings Only

All lines here are proper ATX headings or normal prose.
No **bold** or *italic* used as heading labels.

## Section Two

Normal paragraph.
Inline **bold** and *italic* in the middle of a sentence are fine.

View Activity History:

## Next Section

Short title-case line above has no prose after.
Next non-blank is this heading.
So it is not reported.

Quick Reference:
