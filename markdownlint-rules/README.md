# Custom Markdownlint Rules

- [Overview](#overview)
- [Reusing These Rules](#reusing-these-rules)
- [Rules](#rules)
- [Shared Helper](#shared-helper)

## Overview

This directory contains custom rules for [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2).
In this repo they are registered in [.markdownlint-cli2.jsonc](../.markdownlint-cli2.jsonc) and configured in [.markdownlint.yml](../.markdownlint.yml).
You can reuse any of them in your own project; see [Reusing These Rules](#reusing-these-rules) below.

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

### Using in `VS Code` and its Forks

This repo includes [.vscode/settings.json](../.vscode/settings.json) so the [markdownlint extension](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) uses the same custom rules as the CLI when you open the repo in VS Code or a fork (e.g. Cursor).

- **In another repo:** If you copied these rules into that repo, add a `.vscode/settings.json` there with a `markdownlint.customRules` array listing the paths to each rule file (e.g. `"./.markdownlint-rules/ascii-only.js"`).
  Use paths relative to the workspace root. Rule options still come from that repo's `.markdownlint.yml` or `.markdownlint.json`; the extension reads both the custom rule paths and the config file.

Example for a repo that has copied rules into `.markdownlint-rules/`:

```json
{
  "markdownlint.customRules": [
    "./.markdownlint-rules/allow-custom-anchors.js",
    "./.markdownlint-rules/ascii-only.js",
    "./.markdownlint-rules/heading-numbering.js",
    "./.markdownlint-rules/heading-title-case.js",
    "./.markdownlint-rules/no-duplicate-headings-normalized.js",
    "./.markdownlint-rules/no-heading-like-lines.js",
    "./.markdownlint-rules/no-h1-content.js"
  ]
}
```

Do not list `utils.js` in `markdownlint.customRules`; it is a helper, not a rule.

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

### `no-h1-content`

**File:** `no-h1-content.js`

**Description:** Under the first h1 heading, allow only table-of-contents content (blank lines, list-of-links, badges, HTML comments). No prose or other content is permitted.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `no-h1-content`:

```yaml
no-h1-content:
  excludePathPatterns:
    - "md_test_files/**"   # optional; skip rule for these paths
```

- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.

**Behavior:** The block of lines after the first `#` heading and before the next heading (any level) may only contain blank lines, list items that are anchor links (e.g. `- [Section](#section)` or `1. [Section](#section)`), badge lines (e.g. `[![alt](url)](url)`), and HTML comments.
Any other line (prose, code blocks, etc.) is reported.

### `document-length`

**File:** `document-length.js`

**Description:** Disallow documents longer than a configured number of lines.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `document-length`:

```yaml
document-length:
  maximum: 1500   # optional; default 1500
```

- **`maximum`** (number, default `1500`): Maximum allowed line count. Must be a positive integer.

**Behavior:** When the file has more than `maximum` lines, the rule reports a single error on line 1. The message includes the actual line count and the maximum and suggests splitting into smaller files.

### `ascii-only`

**File:** `ascii-only.js`

**Description:** Disallow non-ASCII except in configured paths; optional replacement suggestions via `unicodeReplacements`.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `ascii-only`:

Example: minimal (default letters plus path/emoji)

```yaml
ascii-only:
  allowedPathPatternsUnicode:
    - "**/README.md"          # any non-ASCII allowed in READMEs
  allowedPathPatternsEmoji:
    - "docs/**"               # only allowedEmoji in docs/
  allowedEmoji:
    - "✅"
    - "⚠️"
```

Example: extend default allowed characters (e.g. degree sign, or `ń` for Polish)

```yaml
ascii-only:
  allowedUnicode:
    - "°"
    - "ń"                     # merged with default (é, ï, ñ, ç, etc.)
  # allowedUnicodeReplaceDefault: false  # default; true = use only the list above
```

Example: override default (strict allowlist only)

```yaml
ascii-only:
  allowedUnicode:
    - "°"
    - "→"                     # only these two allowed in prose
  allowedUnicodeReplaceDefault: true
```

Example: check unicode inside code blocks (e.g. only in `text` and `bash` blocks)

```yaml
ascii-only:
  allowUnicodeInCodeBlocks: false
  disallowUnicodeInCodeBlockTypes:
    - "text"
    - "bash"                  # ```text and ```bash checked; ```go skipped
```

Example: custom replacement suggestions in error messages

```yaml
ascii-only:
  unicodeReplacements:        # object form
    "→": "->"
    "←": "<-"
    "°": " deg"
  # or array form:
  # unicodeReplacements: [["→", "->"], ["←", "<-"]]
```

Example: full configuration combining options

```yaml
ascii-only:
  allowedPathPatternsUnicode:
    - "**/README.md"
    - "**/CHANGELOG*.md"
  allowedPathPatternsEmoji:
    - "docs/**"
  allowedEmoji:
    - "✅"
    - "❌"
    - "⚠️"
  allowedUnicode:
    - "°"
    - "ń"
  allowUnicodeInCodeBlocks: true    # default; set false to check fenced blocks
  # disallowUnicodeInCodeBlockTypes: ["text", "bash"]  # when allowUnicodeInCodeBlocks false
  unicodeReplacements:
    "→": "->"
    "—": "--"
```

- **`allowedPathPatternsUnicode`** (list of strings, default none): Glob patterns for files where any non-ASCII is allowed.
- **`allowedPathPatternsEmoji`** (list of strings, default none): Glob patterns for files where only `allowedEmoji` characters are allowed.
- **`allowedEmoji`** (list of strings, default none): Emoji (or other chars) allowed in paths matching `allowedPathPatternsEmoji`; each entry may be multi-codepoint (e.g. ⚠️); all code points are allowed.
- **`allowedUnicode`** (list of single-character strings, optional): Characters allowed in all files (global allowlist). By default these **extend** the built-in set of common non-English letters (e.g. é, ï, è, ñ, ç). Set **`allowedUnicodeReplaceDefault: true`** to **override** and use only your list (no default set).
- **`allowedUnicodeReplaceDefault`** (boolean, default false): When true, only `allowedUnicode` is used (no built-in default set).
- **`allowUnicodeInCodeBlocks`** (boolean, default true): When true, lines inside fenced code blocks are not checked.
  When false, code blocks are checked (or only those in `disallowUnicodeInCodeBlockTypes` if that list is non-empty).
- **`disallowUnicodeInCodeBlockTypes`** (list of strings, default empty):
  When `allowUnicodeInCodeBlocks` is false, only fenced blocks whose info string (e.g. `text`, `bash`) is in this list are checked; block type is the first word after the opening fence.
  When empty, all code blocks are checked.
- **`unicodeReplacements`** (object or array of [char, replacement], default built-in): Map of single Unicode character to suggested ASCII replacement in error messages. When omitted, rule uses built-in defaults (arrows, quotes, <=, >=, \*).

Glob matching supports `**` (any path) and `*` (within a segment).
Paths are normalized (forward slashes, leading `./` removed).
Relative patterns (no leading `/` or `*`) match both path-prefix (e.g. `dev_docs/foo.md`) and mid-path (e.g. absolute paths containing `dev_docs/`).

#### Behavior (`ascii-only`)

- No built-in path or emoji defaults; configure `allowedPathPatternsUnicode`, `allowedPathPatternsEmoji`, and `allowedEmoji` as needed.
- If the file path matches `allowedPathPatternsUnicode`, any non-ASCII is allowed in that file.
- If the file path matches `allowedPathPatternsEmoji`, only characters in `allowedEmoji` (and Unicode variation selectors U+FE00-U+FE0F) are allowed; other non-ASCII is reported per occurrence.
- Characters allowed in all files: the default set (e.g. é, ï, ñ, ç) plus `allowedUnicode` when **extend** (default), or only `allowedUnicode` when `allowedUnicodeReplaceDefault: true`.
- Non-ASCII is detected by code-point iteration (surrogate pairs treated as one character) and compared after NFC normalization.
- **One error per disallowed character:** each violation highlights only that character (range) on the line. The detail names the character, its code point (e.g. U+2192), and the suggested replacement when present in `unicodeReplacements`.
- Inline code (backticks) is stripped before scanning. Fenced code blocks are skipped by default; set `allowUnicodeInCodeBlocks: false` to check them, and optionally `disallowUnicodeInCodeBlockTypes` to restrict which block types (e.g. `text`, `bash`) are checked.

### `heading-title-case`

**File:** `heading-title-case.js`

**Description:** Enforce AP-style (Associated Press) headline capitalization for headings.
  Words inside backticks are not checked. A configurable set of minor words (e.g. "vs", "and", "the", "is") stay lowercase except when they are the first word, last word, or the first word after a colon or after `(` / `[`.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `heading-title-case`:

```yaml
heading-title-case:
  lowercaseWords:   # optional; extends default list (add words)
    - "through"
  # lowercaseWordsReplaceDefault: true   # optional; true = use only lowercaseWords list, no default
```

- **`lowercaseWords`** (array of strings, optional): Words that must be lowercase in the middle of a heading.
  By default these **extend** the built-in list (articles, conjunctions, short prepositions, etc.).
  Set **`lowercaseWordsReplaceDefault: true`** to **override** and use only your list.
- **`lowercaseWordsReplaceDefault`** (boolean, default false): When true, only `lowercaseWords` is used (no built-in default list).

Built-in default list (when not replaced):

  ```text
  a, an, the,
  and, but, for, nor, or, so, yet,
  as, at, by, in, of, off, on, out, per, to, up, via,
  is, its,
  v, vs
  ```

**Behavior (AP headline rules):** For each ATX heading, the title part (after stripping any numeric prefix like `1.2.3`) is checked.
Content inside inline code (backticks) is ignored.

- **First and last words** of the heading must be capitalized (including the first and last segment of hyphenated compounds).
- **First word after a colon** (e.g. `Summary: The Results`) and the **first word inside parentheses or brackets** (e.g. `(in Practice)`, `[optional]`) are treated as phrase starts and must be capitalized even if they are in the lowercase list.
- **Hyphenated compounds** (e.g. `One-Stop`, `Follow-Up`) are split on hyphens; each segment is checked as above (first/last of title or minor word in the middle).
- **Minor words** (in the default or configured list) must be lowercase when in the middle of the heading; all other words must be capitalized.
- Leading and trailing punctuation is ignored when evaluating a word (e.g. `(Word)` is evaluated as `Word`).

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
2. **Section-scoped consistency:** For each section (siblings under the same parent), if any sibling has numbering then all siblings at that level must be numbered sequentially and use consistent period style (all `## 1. Title` or all `## 1 Title`).
   **Index base:** Default is 1-based (e.g. 1., 2., 3.). If the first numbered sibling in a section has last segment `0` (e.g. `0.`, `0.0.`, `1.0.`), that section is treated as 0-based (0., 1., 2. or 0.0., 0.1., etc.) and no sequence error is reported.
   Unnumbered siblings in a numbered section are reported.

## Shared Helper

**utils.js** is not a rule; it provides utilities used by several rules.
Do not list it in `customRules` in `.markdownlint-cli2.jsonc`.
When reusing rules that use it, copy `utils.js` into your `.markdownlint-rules` (see [Reusing These Rules](#reusing-these-rules)).

- **Heading and content:** `extractHeadings`, `iterateNonFencedLines`, `stripInlineCode`, `parseHeadingNumberPrefix`, `normalizeHeadingTitleForDup`, `normalizedTitleForDuplicate`, `RE_ATX_HEADING`, `RE_NUMBERING_PREFIX`.
- **Path/glob matching:** `globToRegExp`, `matchGlob`, `pathMatchesAny` - used for path-pattern options (e.g. ascii-only `allowedPathPatternsUnicode`).
  Supports `**` and `*`; paths normalized to forward slashes; relative patterns match path prefix or mid-path.
