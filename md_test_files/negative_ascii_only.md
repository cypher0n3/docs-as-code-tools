# Negative Fixture: ASCII-Only

This file intentionally contains non-ASCII characters to trigger the ascii-only rule.
Path is under dev_docs, so only allowed emoji (e.g. ✅) are permitted; arrows and smart quotes are not.

- Line with Unicode arrow: use → here (should highlight only the arrow).
- Line with smart quotes: “curly” and ‘curly’ (each curly quote highlighted).

No allowed emoji in this list; if we add ✅ it should not be reported.

```markdownlint-expect
{
  "total": 7,
  "errors": [
    { "line": 4, "rule": "ascii-only" },
    { "line": 6, "rule": "ascii-only" },
    { "line": 7, "rule": "ascii-only" },
    { "line": 7, "rule": "ascii-only" },
    { "line": 7, "rule": "ascii-only" },
    { "line": 7, "rule": "ascii-only" },
    { "line": 9, "rule": "ascii-only" }
  ]
}
```
