# Negative Fixture: One Sentence per Line (Cross-Line)

<!-- Lint: `npx markdownlint-cli2 md_test_files/negative_one_sentence_per_line_cross_line.md` -->
<!-- Expect: `one-sentence-per-line` (cross-line wraps). -->

## Wrapped Paragraph

This sentence is hard-wrapped
across two physical lines.

## Wrapped List Item

- First part of the bullet
  continues on the next line.

## Chained Wrap

Alpha beta gamma
delta epsilon zeta
eta theta iota.

## Wrap Into Inline-Code-Only Continuation

- [x] New file `internal/agent/debug.go`: helpers `formatDebugRequest`,
  `formatDebugEvent`, `buildDebugRequest`, `injectDebugRequest`.

## Wrap From Inline-Code Tail

- See details below `foo`
  is the answer.

## Suppressed (Should Not Report)

<!-- one-sentence-per-line check_cross_line disable -->
This wrapped sentence is intentionally
broken across two lines.
<!-- one-sentence-per-line check_cross_line enable -->

<!-- one-sentence-per-line check_cross_line allow -->
Another one-off wrap that
is tolerated here.
