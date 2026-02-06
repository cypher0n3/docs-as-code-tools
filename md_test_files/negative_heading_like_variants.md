# Negative Fixture: Heading-like Line Variants

Expect: `no-heading-like-lines` (italic and numbered-list variants).

```markdownlint-expect
{
  "total": 3,
  "errors": [
    { "line": 18, "rule": "no-heading-like-lines" },
    { "line": 20, "rule": "no-heading-like-lines" },
    { "line": 22, "rule": "no-heading-like-lines" }
  ]
}
```

## Pseudo-headings

*Italic with colon inside:*

*Italic with colon outside*:

1. **Numbered list with bold only**
