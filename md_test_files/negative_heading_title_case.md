# Negative Fixture: Heading Title Case

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_title_case.md`

Expect: `heading-title-case` (first word lowercase; middle "and" capitalized; last word lowercase).

```markdownlint-expect
{
  "total": 5,
  "errors": [
    { "line": 20, "rule": "heading-title-case" },
    { "line": 24, "rule": "heading-title-case" },
    { "line": 28, "rule": "heading-title-case" },
    { "line": 32, "rule": "heading-title-case" },
    { "line": 36, "rule": "heading-title-case" }
  ]
}
```

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
