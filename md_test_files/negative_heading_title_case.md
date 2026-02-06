# Negative Fixture: Heading Title Case

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_title_case.md`

Expect: `heading-title-case` (first word lowercase; middle "and" capitalized; last word lowercase).

## getting started

Lowercase first word.

## The Cat And the Hat

Middle "and" should be lowercase.

## Using Tools in practice

Last word "practice" should be capitalized; "in" should be lowercase.

## Using Tools (in Practice)

This should fail: first word inside parentheses should be capitalized (treated as a new sentence start).

## Using Tools (in practice) Again

This should fail: "in" should be capitalized (first word inside parentheses) and "practice" should be capitalized (major word).

```markdownlint-expect
{
  "total": 5,
  "errors": [
    { "line": 7, "rule": "heading-title-case" },
    { "line": 11, "rule": "heading-title-case" },
    { "line": 15, "rule": "heading-title-case" },
    { "line": 19, "rule": "heading-title-case" },
    { "line": 23, "rule": "heading-title-case" }
  ]
}
```
