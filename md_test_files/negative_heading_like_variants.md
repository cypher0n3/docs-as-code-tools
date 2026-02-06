# Negative Fixture: Heading-like Line Variants

Expect: `no-heading-like-lines` (italic and numbered-list variants).

## Pseudo-headings

*Italic with colon inside:*

*Italic with colon outside*:

1. **Numbered list with bold only**

```markdownlint-expect
{
  "total": 3,
  "errors": [
    { "line": 7, "rule": "no-heading-like-lines" },
    { "line": 9, "rule": "no-heading-like-lines" },
    { "line": 11, "rule": "no-heading-like-lines" }
  ]
}
```
