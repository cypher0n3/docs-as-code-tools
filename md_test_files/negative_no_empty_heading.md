# Negative Fixture: No Empty Heading (H2+)

- [Section With Content](#section-with-content)
- [Empty H2](#empty-h2)
- [Next Section](#next-section)
  - [Empty H3](#empty-h3)
  - [H3 With Content](#h3-with-content)
- [Another Empty H2 at End](#another-empty-h2-at-end)
- [Empty With Wrong Comment](#empty-with-wrong-comment)
- [Empty With Suppress on Same Line](#empty-with-suppress-on-same-line)
- [Empty With Wrong-Format Suppress](#empty-with-wrong-format-suppress)

## Section With Content

This paragraph is content, so this H2 is valid.

## Empty H2

<!-- This heading should error -->

## Next Section

Content here.

### Empty H3

<!-- This heading should error -->

#### H4 With Content

<!-- This heading should NOT error -->

Valid content.

### H3 With Content

<!-- This heading should NOT error -->

Valid content.

## Another Empty H2 at End

## Empty With Wrong Comment

<!-- placeholder -->

## Empty With Suppress on Same Line

<!-- x --> <!-- no-empty-heading allow -->

## Empty With Wrong-Format Suppress

<!-- no-empty-heading: allow -->

<!-- no-empty-heading disable -->

## In Disable Block 1

## In Disable Block 2

<!-- no-empty-heading enable -->

## Empty After Enable
