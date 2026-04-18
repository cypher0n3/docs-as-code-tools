# Positive Fixture: One Sentence per Line (Cross-Line)

<!-- Lint: `npx markdownlint-cli2 md_test_files/positive_one_sentence_per_line_cross_line.md` -->
<!-- Expect: no errors. -->

## One Physical Sentence per Line

First sentence on one line.
Second sentence on its own line.

## List With One Sentence per Item

- First item is complete.
- Second item is complete.

## Trailing Colon Closes a Line

The following items are listed:

- Alpha.
- Beta.

## Suppressed Wrap

<!-- one-sentence-per-line check_cross_line disable -->
This sentence is intentionally
wrapped across lines.
<!-- one-sentence-per-line check_cross_line enable -->
