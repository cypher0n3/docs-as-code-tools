# Negative Fixture: Heading-like Lines

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_like.md`

Expect: `no-heading-like-lines`.

```markdownlint-expect
{
  "total": 1,
  "errors": [
    { "line": 18, "rule": "no-heading-like-lines" }
  ]
}
```

## Pseudo-headings

**This looks like a heading:**
