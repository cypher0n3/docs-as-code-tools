# Negative Fixture: Anchor Invalid ID

<!-- Expect: `allow-custom-anchors` (id does not match any allowedIdPatterns). -->

## Bad Anchor ID

An anchor with an id that is not in the configured pattern list.

<a id="random-custom-id"></a>

Valid patterns are spec-*, ref-*, algo-* etc. This one matches none.
