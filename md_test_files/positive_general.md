# Markdown Standards Fixtures - Positive Cases

[![Python tests](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml)

[![Docs Check][badge-docs-check]][workflow-docs-check] [![Go CI][badge-go-ci]][workflow-go-ci] [![License][badge-license]][license-file]

- [Formatting](#formatting)
- [Lists](#lists)
- [Links](#links)
- [Inline Code](#inline-code)
- [Code Blocks](#code-blocks)
- [Unicode/Emoji in Code (No Ascii-Only Errors)](#unicodeemoji-in-code-no-ascii-only-errors)
- [Allowed Inline HTML Anchors](#allowed-inline-html-anchors)
  - [Spec Anchor](#spec-anchor)
  - [Reference Anchor](#reference-anchor)
  - [Algorithm Anchor and Step Anchors](#algorithm-anchor-and-step-anchors)
- [Headings](#headings)
  - [1. Heading Numbering Example](#1-heading-numbering-example)
  - [2. Parentheses and Brackets (Are Fine) in Headings](#2-parentheses-and-brackets-are-fine-in-headings)
  - [3. Using Tools (In Practice)](#3-using-tools-in-practice)
  - [4. How to Do a Follow-Up](#4-how-to-do-a-follow-up)
  - [5. Summary: The Results](#5-summary-the-results)
  - [6. Phase A: Fixable Rules and Scripts (One-Time)](#6-phase-a-fixable-rules-and-scripts-one-time)
  - [7. This Has a Lowercase a in the Title](#7-this-has-a-lowercase-a-in-the-title)
  - [8. Using 5e in Experiments](#8-using-5e-in-experiments)
- [Zero-Indexed Heading Numbering](#zero-indexed-heading-numbering)
  - [0. Introduction (Zero-Indexed)](#0-introduction-zero-indexed)
  - [1. First Topic](#1-first-topic)
  - [2. Second Topic](#2-second-topic)
- [Nested Code Blocks Check](#nested-code-blocks-check)
- [Heading With Per-Section in Name](#heading-with-per-section-in-name)
- [Intentionally Empty (Suppressed)](#intentionally-empty-suppressed)
- [Intentionally Empty With Other Comments (Suppressed)](#intentionally-empty-with-other-comments-suppressed)

## Formatting

This file contains examples that should pass the Markdown standards enforced by markdownlint and the Python validators.
It is intended to be linted explicitly via `npx markdownlint-cli2 md_test_files/positive_general.md`.

This paragraph has one sentence.
This is another sentence on its own line.

## Lists

- This is a list item with one sentence.
- This is a second list item.

1. This is an ordered list item.
2. This is a second ordered list item.

## Links

This references a repository file path as a link.
See [`docs/docs_standards/markdown_conventions.md`](../../docs/docs_standards/markdown_conventions.md).

## Inline Code

Use inline code for identifiers like `Spec ID`.

If you need inline code that contains backticks, use a longer delimiter like:

```markdown
``Something `backticked` inside``
```

## Code Blocks

```go
// Example is a small Go snippet.
func Example() {}
```

## Unicode/Emoji in Code (No Ascii-Only Errors)

Unicode and emoji inside inline code or fenced blocks are ignored by ascii-only.
Default-allowed letters (e.g. é, ï, ñ) are allowed in prose; config `allowedUnicode` can add more (e.g. `ń`).

- Default-allowed in prose: Café and naïve are allowed by default.
- Config-allowed in prose: `ń` is allowed when listed in `allowedUnicode` in config.
- Inline code only: use `→` or `ł` or `😀` here (no violation; rule ignores content inside backticks).
- Fenced block below is skipped by rule; unicode/emoji inside are ignored:

```text
Arrow → and ł and 😀 inside fenced block — no ascii-only error.
```

## Allowed Inline HTML Anchors

These anchor examples are permitted by the custom markdownlint rule `allow-custom-anchors`.

### Spec Anchor

- Spec ID: `NP.CORE.Package.ReadFile` <a id="spec-np-core-package-readfile"></a>

### Reference Anchor

<a id="ref-go-np-core-package-readfile"></a>

```go
// ReadFile is an example signature.
func (p *Package) ReadFile(path string) ([]byte, error)
```

### Algorithm Anchor and Step Anchors

Some content here.

#### 1. `Package.ReadFile` Algorithm

<a id="algo-np-core-package-readfile"></a>

1. Validate input path. <a id="algo-np-core-package-readfile-step-1"></a>
2. Return a stream for the file. <a id="algo-np-core-package-readfile-step-2"></a>

## Headings

Under an unnumbered H2, first numbered level has one segment (1., 2.); next level has two (1.1, 1.2).

### 1. Heading Numbering Example

This section demonstrates numbering under an unnumbered H2.

#### 1.1 Nested Heading Numbering Example

This section demonstrates nested numbering (H4 under numbered H3).

### 2. Parentheses and Brackets (Are Fine) in Headings

This heading demonstrates that leading/trailing punctuation like parentheses does not affect title-case checks.

### 3. Using Tools (In Practice)

This heading demonstrates that the first word inside parentheses is treated as a new sentence start for title case.

### 4. How to Do a Follow-Up

AP style: hyphenated compounds (each segment capitalized); "to" and "a" lowercase in the middle.

### 5. Summary: The Results

AP style: first word after a colon is capitalized (subphrase start).

### 6. Phase A: Fixable Rules and Scripts (One-Time)

Single letter after "Phase" is treated as a phase label and stays capitalized (not the article "a").

### 7. This Has a Lowercase a in the Title

Should not catch.

### 8. Using 5e in Experiments

Scientific notation (e.g. 5e, 1e6) in headings is not title-cased; the "e" is left as-is.

## Zero-Indexed Heading Numbering

When the first numbered heading in a section starts at 0, the rule treats that section as 0-based and does not report errors.

### 0. Introduction (Zero-Indexed)

Content under first 0-based H3.

#### 0.1 Zero Indexed Section

Some content here.

### 1. First Topic

Some content here.

### 2. Second Topic

Subsections under a 0-based H3 also use 0-based numbering when the first subheading is 0.

#### 2.1. First Subsection

Duplicate pairs include "1. Overview" with "2. Overview", and "1.1 Scope" with "2.1 Scope".
The above sentence should not trigger the one-sentence-per-line rule.

#### 2.2. Second Subsection

Some content here.

## Nested Code Blocks Check

````markdown
<a id="ref-go-np-core-package-readfile"></a>

```go
func (p *Package) ReadFile(path string) ([]byte, error)
```
````

## Heading With Per-Section in Name

This heading has "Per-Section" in the name; "Per" in this case should be capitalized.

## Intentionally Empty (Suppressed)

<!-- no-empty-heading allow -->

## Intentionally Empty With Other Comments (Suppressed)

<!-- placeholder -->
<!-- no-empty-heading allow -->

## Line-Level HTML Comment Suppress

The following line would normally trigger ascii-only (non-ASCII arrow) but is allowed via the comment on the previous line or at end of line.

<!-- ascii-only allow -->
Use arrow → here (suppressed). <!-- ascii-only allow -->

[badge-docs-check]: https://example.com/docs.svg
[workflow-docs-check]: https://example.com/workflow-docs
[badge-go-ci]: https://example.com/go-ci.svg
[workflow-go-ci]: https://example.com/workflow-go
[badge-license]: https://example.com/license.svg
[license-file]: LICENSE
