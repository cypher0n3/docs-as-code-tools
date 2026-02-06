# Negative Fixture: Reference Anchor Placement

Lint: `npx markdownlint-cli2 md_test_files/negative_anchor_ref_placement.md`

Expect: allow-custom-anchors (ref anchor placement), MD031 (blanks around fences).

## Bad Reference Anchor Placement

This should be rejected because reference anchors must be on their own line directly above a fenced code block.
<a id="ref-go-np-core-package-readfile"></a>
```go
func (p *Package) ReadFile(path string) ([]byte, error)
```

```markdownlint-expect
{
  "total": 2,
  "errors": [
    { "line": 10, "rule": "allow-custom-anchors" },
    { "line": 11, "rule": "MD031/blanks-around-fences" }
  ]
}
```
