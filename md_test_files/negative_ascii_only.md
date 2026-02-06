# Negative Fixture: ASCII-Only

This file intentionally contains non-ASCII characters to trigger the ascii-only rule.

```markdownlint-expect
{
  "total": 6,
  "errors": [
    { "line": 21, "rule": "ascii-only", "column": 32 },
    { "line": 22, "rule": "ascii-only", "column": 27 },
    { "line": 22, "rule": "ascii-only", "column": 33 },
    { "line": 22, "rule": "ascii-only", "column": 39 },
    { "line": 22, "rule": "ascii-only", "column": 45 },
    { "line": 24, "rule": "ascii-only", "column": 42 }
  ]
}
```

## ASCII-Only Tests

- Line with Unicode arrow: use → here (should highlight only the arrow).
- Line with smart quotes: “curly” and ‘curly’ (each curly quote highlighted).

No allowed emoji in this list; if we add ✅ it should be reported.
