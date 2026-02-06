# Custom Markdownlint Rules

This directory contains custom rules for [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2).
In this repo they are registered in [.markdownlint-cli2.jsonc](../.markdownlint-cli2.jsonc) and configured in [.markdownlint.yml](../.markdownlint.yml).
You can reuse any of them in your own project; see [Reusing These Rules](#reusing-these-rules) below.

## Overview

- **Rule modules**: Each `*.js` file here (except `utils.js`) is a custom rule.
- **Config**: Rule-specific options are set under the rule name in a markdownlint config file.
  You can use `.markdownlint.yml` or `.markdownlint.json` (markdownlint accepts either).
  Only rules that accept options are documented with a config section below.
  **Regex patterns in YAML:** use single quotes so backslashes are not interpreted by YAML (e.g. `'\s'` instead of `"\\s"`), avoiding unnecessary double escapes.

## Reusing These Rules

To use one or more of these rules in another repo:

1. Create a `.markdownlint-rules` directory in that repo (if it does not exist).
2. Copy the rule file(s) you want (e.g. `ascii-only.js`, `no-heading-like-lines.js`) into `.markdownlint-rules`.
3. If a rule depends on helpers, copy those too.
   Several rules use **utils.js** (see [Shared Helper](#shared-helper)); copy `utils.js` into `.markdownlint-rules` and do **not** list it in `customRules` (see below).
4. In the repo root, in `.markdownlint-cli2.jsonc` (or your config file), add the rule name(s) to the `customRules` array and set `customRulePaths` so it points at your `.markdownlint-rules` folder (see [markdownlint-cli2 custom rules](https://github.com/DavidAnson/markdownlint-cli2#custom-rules)).
5. For rules that accept options, add a section under the rule name in `.markdownlint.yml` (or `.markdownlint.json`) and set the options you need (see each rule's **Configuration** below).

Example `.markdownlint.yml` with custom rules that have options:

```yaml
default: true

# ascii-only: allow certain paths/emoji
ascii-only:
  allowedPathPatternsEmoji:
    - "**/README.md"
  allowedEmoji:
    - "✅"
    - "⚠️"

# heading-title-case: optional override of lowercase words
heading-title-case:
  lowercaseWords:
    - "a"
    - "an"
    - "the"
    - "vs"
    - "and"
    - "or"
```

The same structure works in `.markdownlint.json` (use JSON object keys and arrays instead of YAML).

## Rules

### `allow-custom-anchors`

**File:** `allow-custom-anchors.js`

**Description:** Allow only configured `<a id="..."></a>` anchor id patterns; optional configurable placement rules (heading match, line match, etc.).

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `allow-custom-anchors`:

```yaml
allow-custom-anchors:
  allowedIdPatterns:
    - pattern: '^my-anchor-[a-z0-9-]+$'
      placement:
        standaloneLine: true
        requireAfter:
          - blank
          - fencedBlock
    - '^simple-regex$'   # no placement
  strictPlacement: true
```

- **`allowedIdPatterns`** (array of strings or pattern objects, required):
  Each entry is a regex string or `{ pattern: string, placement?: object }`.
  No built-in default.
  In YAML, use single quotes for regex values to avoid double-escaping backslashes.
- **`strictPlacement`** (boolean, default `true`): If `true`, enforce placement when the matching pattern has a `placement` object; if `false`, only id match and anchor at end of line.

**Per-pattern placement** (optional `placement` on an entry in `allowedIdPatterns`):

- **`headingMatch`** (string): Optional. Regex for the heading line. Anchor must be inside a section whose heading matches (sections tracked by heading level).
- **`lineMatch`** (string): Optional. Regex for the line content before the anchor. The line (before the anchor) must match.
- **`standaloneLine`** (boolean): Optional. If true, anchor must be the only content on its line.
- **`requireAfter`** (array): Optional. Sequence after anchor line: `["blank"]`, `["blank", "fencedBlock"]`, or `["blank", "list"]`.
- **`anchorImmediatelyAfterHeading`** (boolean): Optional. If true, anchor line must follow (with optional blank lines) a heading. When `headingMatch` is set, that heading must match it; otherwise the previous non-blank line may be any ATX heading (`#`-`######`). Works when the anchor shares a line with other content (e.g. end of a list item).
- **`maxPerSection`** (number): Optional. Max anchors of this pattern per `headingMatch` section (e.g. 1).

Order of entries matters: the first pattern that matches the anchor id is used. Put more specific patterns (e.g. algo-step) before general ones (e.g. algo). Entries may be a plain regex string (no placement) or `{ pattern: "regex", placement: { ... } }`.

#### Behavior (`allow-custom-anchors`)

- Only `<a id="..."></a>` is allowed (no other attributes, no inner content).
- Anchor `id` must match one of the configured patterns in `allowedIdPatterns`.
- Anchors must appear at the end of the line (or on a standalone line where required by that pattern's placement).
- When `strictPlacement` is true and the matching pattern has a `placement` object, the anchor is validated against that placement (heading match, line match, standalone, require-after, etc.).
- Error messages are prefixed with a sub-rule tag in brackets (e.g. `[lineMatch]`, `[headingMatch]`, `[requireAfter]`, `[allowedIdPatterns]`) so you can see which check failed.

### `no-heading-like-lines`

**File:** `no-heading-like-lines.js`

**Description:** Disallow heading-like lines that should be proper Markdown headings.

**Configuration:** None.

**Behavior:** Reports lines that look like headings but are not (e.g. `**Text:**`, `**Text**:`, `1. **Text**`, and italic variants). Prompts use of real `#` headings instead.

### `ascii-only`

**File:** `ascii-only.js`

**Description:** Disallow non-ASCII except in configured paths; optional replacement suggestions via `unicodeReplacements`.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `ascii-only`:

```yaml
ascii-only:
  allowedPathPatternsUnicode:
    - "**/README.md"
  allowedPathPatternsEmoji:
    - "docs/**"
  allowedEmoji:
    - "✅"
    - "⚠️"
  allowedUnicode:
    - "°"   # optional: allow in all files
```

- **`allowedPathPatternsUnicode`** (list of strings, default none): Glob patterns for files where any non-ASCII is allowed.
- **`allowedPathPatternsEmoji`** (list of strings, default none): Glob patterns for files where only `allowedEmoji` characters are allowed.
- **`allowedEmoji`** (list of strings, default none): Emoji (or other chars) allowed in paths matching `allowedPathPatternsEmoji`; each entry may be multi-codepoint (e.g. ⚠️); all code points are allowed.
- **`allowedUnicode`** (list of single-character strings, default none): Optional. Characters allowed in all files (global allowlist).
- **`unicodeReplacements`** (object or array of [char, replacement], default built-in): Map of single Unicode character to suggested ASCII replacement in error messages. When omitted, rule uses built-in defaults (arrows, quotes, <=, >=, \*).

Glob matching supports `**` (any path) and `*` (within a segment).
Paths are normalized (forward slashes, leading `./` removed).
Relative patterns (no leading `/` or `*`) match both path-prefix (e.g. `dev_docs/foo.md`) and mid-path (e.g. absolute paths containing `dev_docs/`).

#### Behavior (`ascii-only`)

- No built-in path or emoji defaults; configure `allowedPathPatternsUnicode`, `allowedPathPatternsEmoji`, and `allowedEmoji` as needed.
- If the file path matches `allowedPathPatternsUnicode`, any non-ASCII is allowed in that file.
- If the file path matches `allowedPathPatternsEmoji`, only characters in `allowedEmoji` (and Unicode variation selectors U+FE00-U+FE0F) are allowed; other non-ASCII is reported per occurrence.
- Characters in `allowedUnicode` (when configured) are allowed in all files.
- Non-ASCII is detected by code-point iteration (surrogate pairs treated as one character) and compared after NFC normalization.
- **One error per disallowed character:** each violation highlights only that character (range) on the line. The detail names the character, its code point (e.g. U+2192), and the suggested replacement when present in `unicodeReplacements`.
- Inline code (backticks) is stripped before scanning.

### `heading-title-case`

**File:** `heading-title-case.js`

**Description:** Enforce title case (capital case) for headings. Words inside backticks are not checked. A configurable set of words (e.g. "vs", "and", "the") stay lowercase except when they are the first or last word.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `heading-title-case`:

```yaml
heading-title-case:
  lowercaseWords:   # optional; default list if omitted
    - "a"
    - "an"
    - "the"
    - "vs"
    - "and"
    - "or"
```

- **`lowercaseWords`** (array of strings, optional): Words that must be lowercase in the middle of a heading. If omitted, a default list is used: a, an, the, and, or, but, nor, so, yet, as, at, by, for, in, of, on, to, vs, via, per, into, with, from, than, when, if, unless, because, although, while.

**Behavior:** For each ATX heading, the title part (after stripping any numeric prefix like `1.2.3`) is checked. Content inside inline code (backticks) is ignored.

- First and last words must be capitalized; middle words that are in the lowercase list must be lowercase; all other words must be capitalized.
- Leading and trailing punctuation is ignored when evaluating a word (e.g. `(Word)` is evaluated as `Word`).
- Parenthesized and bracketed phrases behave like a sentence start for title-case purposes:
  the first word inside `(...)` or `[...]` must be capitalized, even if it is in the lowercase list.

### `no-duplicate-headings-normalized`

**File:** `no-duplicate-headings-normalized.js`

**Description:** Disallow duplicate heading titles after stripping numbering and normalizing.

**Configuration:** None.

#### Behavior (`no-duplicate-headings-normalized`)

Extracts all headings, strips numeric prefixes (e.g. `1.2.3`), normalizes the title (case/whitespace), and reports any heading whose normalized title appears more than once in the document.
The first occurrence is the reference; duplicates are reported with the line number of the first.

### `heading-numbering`

**File:** `heading-numbering.js`

**Description:** Enforces structure and consistency of numbered headings: segment count by numbering root; numbering sequential within each section; period style consistent within section.

**Configuration:** None.

#### Behavior (`heading-numbering`)

1. **Segment count by numbering root:** For each heading with a numeric prefix (e.g. `### 1.2 Title`), the number of segments (split on `.`) must equal heading level minus the numbering root level.
   The numbering root is the nearest ancestor heading that has no numbering (or document root, level 1).
   Example: H2 under doc root -> 1 segment; H3 under unnumbered `## Section` -> 1 segment; H4 under `### 1. First` -> 1 segment.
   Headings without a numeric prefix are ignored.
2. **Section-scoped consistency:** For each section (siblings under the same parent), if any sibling has numbering then all siblings at that level must be numbered sequentially (e.g. 1., 2., 3.) and use consistent period style (all `## 1. Title` or all `## 1 Title`).
   Unnumbered siblings in a numbered section are reported.

## Shared Helper

**utils.js** is not a rule; it provides utilities used by several rules.
Do not list it in `customRules` in `.markdownlint-cli2.jsonc`.
When reusing rules that use it, copy `utils.js` into your `.markdownlint-rules` (see [Reusing These Rules](#reusing-these-rules)).

- **Heading and content:** `extractHeadings`, `iterateNonFencedLines`, `stripInlineCode`, `parseHeadingNumberPrefix`, `normalizeHeadingTitleForDup`, `normalizedTitleForDuplicate`, `RE_ATX_HEADING`, `RE_NUMBERING_PREFIX`.
- **Path/glob matching:** `globToRegExp`, `matchGlob`, `pathMatchesAny` - used for path-pattern options (e.g. ascii-only `allowedPathPatternsUnicode`).
  Supports `**` and `*`; paths normalized to forward slashes; relative patterns match path prefix or mid-path.
