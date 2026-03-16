# Positive Fixture: Heading Title Case

<!-- Lint: `npx markdownlint-cli2 md_test_files/positive_heading_title_case.md` -->
<!-- Expect: 0 errors (valid AP title case; identifiers in backticks pass). -->

## Getting Started

Normal AP style: first and last words capitalized.

## The Cat and the Hat

Middle word "and" lowercase.

## Summary and `sba_result`

Identifier with underscore in backticks is not checked for title case; passes.

## Overview of `my_var` and Results

Multiple words with backticked identifier; "of" lowercase, "Overview" and "Results" capitalized.

## Using `README.md` in Docs

File name in backticks passes; "in" lowercase in the middle.

## See [Getting Started](docs/getting-started.md) for More

Link text may be human-readable; link text and path are ignored for title case.

## See [`getting-started.md`](docs/getting-started.md) for More

Link text may be the file name in backticks; both formats are acceptable.
