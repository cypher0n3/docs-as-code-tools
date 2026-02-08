# Markdown Standards Fixtures - Positive Cases

This file contains examples that should pass the Markdown standards enforced by markdownlint and the Python validators.

It is intended to be linted explicitly via `npx markdownlint-cli2 md_test_files/positive.md`.

## Formatting

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
