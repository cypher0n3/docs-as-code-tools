# Negative Fixture: Heading Numbering

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_numbering.md`

Expect: heading-numbering (segment count, sequence, period style, unnumbered sibling). All examples are H3/H4 under one H2 so only this section is affected.

## Bad Heading Numbering

### 1. First Section

#### 1.1 First Subsection

#### 1.3 Skip 1.2 (Non-Sequential; Expected 1.2)

### Unnumbered Sibling (Section Uses Numbering; Add Number Prefix)

### 2 No Period (Inconsistent with ### 1.)

Wrong segment count: H3 under H2 must have 1 segment, not 2.

### 1.1. Wrong Segment Count

### 1.1. Too Many Segments for H3

```markdownlint-expect
{
  "total": 6,
  "errors": [
    { "line": 13, "rule": "heading-numbering" },
    { "line": 15, "rule": "heading-numbering" },
    { "line": 17, "rule": "heading-numbering" },
    { "line": 17, "rule": "heading-numbering" },
    { "line": 21, "rule": "heading-numbering" },
    { "line": 23, "rule": "heading-numbering" }
  ]
}
```
