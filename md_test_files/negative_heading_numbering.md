# Negative Fixture: Heading Numbering

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_numbering.md`

Expect: heading-numbering (segment count, sequence, period style, unnumbered sibling). All examples are H3/H4 under one H2 so only this section is affected.

## Bad Heading Numbering

### 1. First Section

#### 1.1 First Subsection

#### 1.3 Skip 1.2 (Non-Sequential; Expected 1.2)

#### 1.3. Has Period but Should Not

### Unnumbered Sibling (Section Uses Numbering; Add Number Prefix)

### 2 No Period (Inconsistent With ### 1.)

Wrong segment count: H3 under H2 must have 1 segment, not 2.

### 1.1 Wrong Segment Count

#### 1.1.1 Too Many Segments for H4
