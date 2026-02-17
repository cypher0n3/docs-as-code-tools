# Negative Fixture: Heading Min Words

<!-- Expect: heading-min-words (H4+ must have at least 2 words when applyToLevelsAtOrBelow: 4). -->

## Valid H2 Section

Content here.

## Another Valid Section

Content.

### Valid H3 Here

Content.

#### Single

Single-word H4 fails when minWords is 2 and applyToLevelsAtOrBelow is 4.

#### Two Words OK

This passes.

#### Another Single Wrong Suppress

Placeholder so no-empty-heading does not report this section.

<!-- ascii-only allow -->

#### Foo

Wrong-rule comment above does not suppress; heading-min-words still reports.
