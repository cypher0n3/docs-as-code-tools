# Positive Fixture: 0-Indexed H2 Numbering

<!-- Lint: `npx markdownlint-cli2 md_test_files/positive_heading_numbering_zero.md` -->
<!-- This file should pass with zero errors. The first H2 is 0-indexed, so the rule treats the top-level section as 0-based. -->

- [0. Introduction](#0-introduction)
- [1. First Section](#1-first-section)
  - [1.0 First Section First Subsection](#10-first-section-first-subsection)
- [2. Second Section](#2-second-section)
  - [2.0. First Subsection](#20-first-subsection)
  - [2.1. Second Subsection](#21-second-subsection)

## 0. Introduction

Content under the first H2 (0-based).

## 1. First Section

Content.

### 1.0 First Section First Subsection

Content.

## 2. Second Section

Subsections under this H2 use 0-based numbering when the first is 2.0.

### 2.0. First Subsection

Some content here.

### 2.1. Second Subsection

Some content here.
