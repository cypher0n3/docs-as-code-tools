# Negative Fixture: ASCII-Only

This file intentionally contains non-ASCII characters to trigger the ascii-only rule.

## ASCII-Only Tests

- Line with Unicode arrow: use → here (should highlight only the arrow).
- Line with smart quotes: “curly” and ‘curly’ (each curly quote highlighted).
- Char not in default or config: Polish ł is reported when not in allowedUnicode.

No allowed emoji in this list; if we add ✅ it should be reported.
