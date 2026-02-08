# Negative Fixture: Inline HTML and Anchor Basics

Lint: `npx markdownlint-cli2 md_test_files/negative_inline_html.md`

Expect: MD033, allow-custom-anchors (wrong attribute, bad id, not end-of-line).

## Bad Inline HTML and Anchors

This should fail MD033 (inline HTML).
<div>nope</div>

This should fail allow-custom-anchors (wrong attribute).
<a name="bad"></a>

This should fail allow-custom-anchors (invalid id prefix).
<a id="bad-np-core-package-readfile"></a>

This should fail allow-custom-anchors (anchor not at end-of-line). <a id="spec-np-core-package-readfile"></a> trailing
