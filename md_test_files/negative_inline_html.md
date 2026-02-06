# Negative Fixture: Inline HTML and Anchor Basics

Lint: `npx markdownlint-cli2 md_test_files/negative_inline_html.md`

Expect: MD033, allow-custom-anchors (wrong attribute, bad id, not end-of-line).

```markdownlint-expect
{
  "total": 4,
  "errors": [
    { "line": 22, "rule": "MD033/no-inline-html" },
    { "line": 25, "rule": "allow-custom-anchors" },
    { "line": 28, "rule": "allow-custom-anchors" },
    { "line": 30, "rule": "allow-custom-anchors" }
  ]
}
```

## Bad Inline HTML and Anchors

This should fail MD033 (inline HTML).
<div>nope</div>

This should fail allow-custom-anchors (wrong attribute).
<a name="bad"></a>

This should fail allow-custom-anchors (invalid id prefix).
<a id="bad-np-core-package-readfile"></a>

This should fail allow-custom-anchors (anchor not at end-of-line). <a id="spec-np-core-package-readfile"></a> trailing
