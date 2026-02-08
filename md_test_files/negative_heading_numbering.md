# Negative Fixture: Heading Numbering

Lint: `npx markdownlint-cli2 md_test_files/negative_heading_numbering.md`

Expect: heading-numbering (segment count, sequence, period style, unnumbered sibling, zero-indexed violations). First block is H3/H4 under one H2; second block covers zero-indexed numbering errors.

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

## Zero-Indexed Numbering (Negative Examples)

0-based section: first heading is 0., so sequence must be 0, 1, 2, ... Violations below.

### 0. Zero-Based Section

### 2. Skip 1 (0-Based Sequence; Expected 1.)

0-based subsections under 0.: first is 0.0., so next must be 0.1., not 0.2.

### 0. Subsection Root (0-Based)

#### 0.0. First Sub

#### 0.2. Skip 0.1 (Expected 0.1.)
