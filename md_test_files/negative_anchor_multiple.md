# Negative Fixture: Multiple Anchors per Line

Lint: `npx markdownlint-cli2 md_test_files/negative_anchor_multiple.md`

Expect: allow-custom-anchors (only one anchor per line), MD032 (blanks around lists).

## Multiple Anchors per Line

This should be rejected because only one anchor is allowed per line.
- Spec ID: `NP.CORE.Package.ReadFile` <a id="spec-np-core-package-readfile"></a> <a id="spec-np-core-package-readfile"></a>

```markdownlint-expect
{
  "total": 2,
  "errors": [
    { "line": 10, "rule": "allow-custom-anchors" },
    { "line": 10, "rule": "MD032/blanks-around-lists" }
  ]
}
```
