# Custom Markdownlint Rules

- [Overview](#overview)
- [Reusing These Rules](#reusing-these-rules)
  - [Using in `VS Code` and its Forks](#using-in-vs-code-and-its-forks)
- [Rules](#rules)
  - [`allow-custom-anchors`](#allow-custom-anchors)
  - [`no-heading-like-lines`](#no-heading-like-lines)
  - [`no-tables`](#no-tables)
  - [`no-h1-content`](#no-h1-content)
  - [`no-empty-heading`](#no-empty-heading)
  - [`document-length`](#document-length)
  - [`ascii-only`](#ascii-only)
  - [`fenced-code-under-heading`](#fenced-code-under-heading)
  - [`heading-min-words`](#heading-min-words)
  - [`heading-title-case`](#heading-title-case)
  - [`no-duplicate-headings-normalized`](#no-duplicate-headings-normalized)
  - [`heading-numbering`](#heading-numbering)
  - [`one-sentence-per-line`](#one-sentence-per-line)
- [Shared Helper](#shared-helper)

## Overview

This directory contains custom rules for [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2).
In this repo they are registered in [.markdownlint-cli2.jsonc](../.markdownlint-cli2.jsonc) and configured in [.markdownlint.yml](../.markdownlint.yml).
A reference config with all rules and options (commented) is [.markdownlint.clean.yml](.markdownlint.clean.yml).
You can reuse any of them in your own project; see [Reusing These Rules](#reusing-these-rules) below.
Some rules are **fixable** (heading-title-case, ascii-only, heading-numbering, no-heading-like-lines, no-tables with `convert-to: list`, one-sentence-per-line): they report `fixInfo` so `markdownlint-cli2 --fix` and the editor "Fix all" can apply corrections automatically.

- **Requirements:** `Node.js` and [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) (or the [markdownlint](https://github.com/DavidAnson/markdownlint) core with custom rule support).
  When reusing rules, copy any helper files they depend on; see [Shared Helper](#shared-helper) for which rules require `utils.js`.
- **Rule modules**: Each `*.js` file here (except `utils.js`) is a custom rule.
- **Config**: Rule-specific options are set under the rule name in a markdownlint config file.
  You can use `.markdownlint.yml` or `.markdownlint.json` (markdownlint accepts either).
  For a single file listing every rule and option in this package, see [.markdownlint.clean.yml](.markdownlint.clean.yml).
  Only rules that accept options are documented with a config section below.
  **Regex patterns in YAML:** use single quotes so backslashes are not interpreted by YAML (e.g. `'\s'` instead of `"\\s"`), avoiding unnecessary double escapes.
- **Suppressing a rule for a line:** Every custom rule supports an HTML comment override.
  Put `<!-- rule-name allow -->` on its own line immediately before the line to suppress, or at the end of the violating line.
  Example: `<!-- no-empty-heading allow -->` on the previous line (or at end of the heading line) suppresses that heading's empty-section violation.

## Reusing These Rules

To use one or more of these rules in another repo:

1. Create a `.markdownlint-rules` directory in that repo (if it does not exist).
2. Copy the rule file(s) you want (e.g. `ascii-only.js`, `no-heading-like-lines.js`) into `.markdownlint-rules`.
3. If a rule depends on helpers, copy those too.
   Most rules require `utils.js` (see [Shared Helper](#shared-helper) for the full list).
   Copy `utils.js` into `.markdownlint-rules` and do **not** list it in `customRules` (see below).
   **no-heading-like-lines** optionally uses `heading-title-case.js` and `heading-numbering.js` when `convertToHeading: true` (for AP title case and number prefixes); copy those into the same directory only if you want that behavior.
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
  Use paths relative to the workspace root.
    Rule options still come from that repo's `.markdownlint.yml` or `.markdownlint.json`; the extension reads both the custom rule paths and the config file.

Example for a repo that has copied rules into `.markdownlint-rules/`:

```json
{
  "markdownlint.customRules": [
    "./.markdownlint-rules/allow-custom-anchors.js",
    "./.markdownlint-rules/ascii-only.js",
    "./.markdownlint-rules/document-length.js",
    "./.markdownlint-rules/fenced-code-under-heading.js",
    "./.markdownlint-rules/heading-min-words.js",
    "./.markdownlint-rules/heading-numbering.js",
    "./.markdownlint-rules/heading-title-case.js",
    "./.markdownlint-rules/no-duplicate-headings-normalized.js",
    "./.markdownlint-rules/no-empty-heading.js",
    "./.markdownlint-rules/no-h1-content.js",
    "./.markdownlint-rules/no-heading-like-lines.js",
    "./.markdownlint-rules/one-sentence-per-line.js"
  ]
}
```

Do not list `utils.js` in `markdownlint.customRules`; it is a helper, not a rule.

## Rules

Custom rule reference:

### `allow-custom-anchors`

**File:** `allow-custom-anchors.js`

**Description:** Allow only configured `<a id="..."></a>` anchor id patterns; optional configurable placement rules (heading match, line match, etc.).

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `allow-custom-anchors`:

```yaml
allow-custom-anchors:
  allowedIdPatterns:
    - pattern: "^my-anchor-[a-z0-9-]+$"
      placement:
        standaloneLine: true
        requireAfter:
          - blank
          - fencedBlock
    - "^simple-regex$" # no placement
  strictPlacement: true
```

- **`allowedIdPatterns`** (array of strings or pattern objects, required):
  Each entry is a regex string or `{ pattern: string, placement?: object }`.
  No built-in default.
  In YAML, use single quotes for regex values to avoid double-escaping backslashes.
- **`strictPlacement`** (boolean, default `true`): If `true`, enforce placement when the matching pattern has a `placement` object; if `false`, only id match and anchor at end of line.

**Per-pattern placement** (optional `placement` on an entry in `allowedIdPatterns`):

- **`headingMatch`** (string): Optional.
  Regex for the heading line.
  Anchor must be inside a section whose heading matches (sections tracked by heading level).
- **`lineMatch`** (string): Optional.
  Regex for the line content before the anchor.
  The line (before the anchor) must match.
- **`standaloneLine`** (boolean): Optional.
  If true, anchor must be the only content on its line.
- **`requireAfter`** (array): Optional.
  Sequence after anchor line: `["blank"]`, `["blank", "fencedBlock"]`, or `["blank", "list"]`.
- **`anchorImmediatelyAfterHeading`** (boolean): Optional.
  If true, anchor line must follow (with optional blank lines) a heading.
  When `headingMatch` is set, that heading must match it; otherwise the previous non-blank line may be any ATX heading (`#`-`######`).
  Works when the anchor shares a line with other content (e.g. end of a list item).
- **`maxPerSection`** (number): Optional.
  Max anchors of this pattern per `headingMatch` section (e.g. 1).

Order of entries matters: the first pattern that matches the anchor id is used.
Put more specific patterns (e.g. algo-step) before general ones (e.g. algo).
Entries may be a plain regex string (no placement) or `{ pattern: "regex", placement: { ... } }`.

#### Behavior (`allow-custom-anchors`)

- Only `<a id="..."></a>` is allowed (no other attributes, no inner content).
- Anchor `id` must match one of the configured patterns in `allowedIdPatterns`.
- Anchors must appear at the end of the line (or on a standalone line where required by that pattern's placement).
- When `strictPlacement` is true and the matching pattern has a `placement` object, the anchor is validated against that placement (heading match, line match, standalone, require-after, etc.).
- Error messages are prefixed with a sub-rule tag in brackets (e.g. `[lineMatch]`, `[headingMatch]`, `[requireAfter]`, `[allowedIdPatterns]`) so you can see which check failed.

### `no-heading-like-lines`

**File:** `no-heading-like-lines.js`

**Description:** Disallow heading-like lines that should be proper Markdown headings.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `no-heading-like-lines` (all optional):

```yaml
no-heading-like-lines:
  convertToHeading: false   # when true, fix converts to ATX heading instead of stripping emphasis
  defaultHeadingLevel: 2    # level when there is no preceding heading (1-6)
  fixedHeadingLevel: 3     # if set, force this level and ignore context
  punctuationMarks: ".,;!?"   # for whole-line emphasis, skip when content ends with one of these (default omits : so colon lines are caught)
  excludePathPatterns:      # optional; skip this rule for matching paths
    - "**/README.md"
```

- **`convertToHeading`** (boolean, default `false`): When false, the default fix strips emphasis to plain text (e.g. `**Summary:**` -> `Summary:`).
  When true, the fix converts the line to an ATX heading with context-aware level (one below the last preceding heading; no prior heading -> `defaultHeadingLevel`).
- **`defaultHeadingLevel`** (number 1-6, default 2): Used when converting to a heading and there is no preceding heading in the document.
- **`fixedHeadingLevel`** (number 1-6, optional): When set, the suggested heading uses this level and ignores context.
- **`punctuationMarks`** (string, default `".,;!?"`): For whole-line emphasis (`**Text**` / `*Text*`), the rule does not report when the emphasized content ends with one of these (treats as sentences).
  Colon is omitted by default so lines ending in colons are always caught (rule is greedier than MD036).
- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.
  When the file path matches any pattern, the rule does not report for that file.

**Fixable:** Yes (config-controlled).
Default fix strips emphasis to plain text.
When `convertToHeading` is true, the fix converts to an ATX heading with context-aware level, adds a blank line after the heading when the next line is non-blank, and when the optional dependency files are present respects numbering (adds the correct number prefix when the section uses numbered headings) and applies AP title case to the heading text (same rules as heading-title-case).

**Behavior:** Reports lines that look like headings but are not (e.g. `**Text:**`, `**Text**:`, `1. **Text**`, italic variants, whole-line emphasis).
Whole-line emphasis ending with a `punctuationMarks` character is not reported; default omits colon so colon lines are always caught (greedier than MD036).
fixInfo replaces with stripped text or ATX heading.
Disable MD036 to avoid duplicates and use this rule's fixInfo for `--fix`.

#### Using Without Heading-Title-Case And/Or Heading-Numbering

You can use `no-heading-like-lines.js` with only `utils.js`; the other rule files are optional.
For the default fix (strip emphasis), no other files are needed.
For `convertToHeading: true`:

- If `heading-title-case.js` is not in the same rules directory, suggested headings use the extracted title as-is (no AP title case).
- If `heading-numbering.js` is not in the same rules directory, no number prefix is added to suggested headings.
  When it is present, a number prefix is only added when the section already uses numbering (i.e. when the parent has numbering or at least one sibling heading at the same level has numbering; see `sectionUsesNumbering` in heading-numbering.js).

To get full convertToHeading behavior (AP title case and numbering), copy `heading-title-case.js` and `heading-numbering.js` into the same directory as `no-heading-like-lines.js`.
The rule degrades gracefully when those files are absent.

### `no-tables`

**File:** `no-tables.js`

**Description:** Disallow GFM tables.
When `convert-to` is `"list"`, the rule suggests converting each table to a list (first column as **Header:**, remaining columns as indented `- header: cell`).
When `convert-to` is `"none"` (default), only a short message is reported and the suggestion is suppressed.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `no-tables`:

```yaml
no-tables:
  convert-to: none   # optional; "none" (default) or "list"
  # excludePathPatterns:
  #   - "**/README.md"
```

- **`convert-to`** (string, default `"none"`): `"none"` = report violation with short message only (no suggested list). `"list"` = include suggested list format in the error detail.
  Only `"list"` and `"none"` are valid; invalid values are treated as `"none"`.
- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.

**Behavior:** Reports every GFM table (outside fenced code blocks).
When `convert-to` is `"none"`, one error per table at the table's first line.
When `convert-to` is `"list"`, one error per table line (so `--fix` can replace the first line with the list and delete the rest).
Suppress per table: put `<!-- no-tables allow -->` on the line before the table's first line, or at the end of that line.

**Fixable:** When `convert-to` is `"list"`, the rule reports `fixInfo` so `--fix` converts each table to the list format.

### `no-h1-content`

**File:** `no-h1-content.js`

**Description:** Under the first h1 heading, allow only table-of-contents content (blank lines, list-of-links, badges, HTML comments).
No prose or other content is permitted.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `no-h1-content`:

```yaml
no-h1-content:
  excludePathPatterns:
    - "md_test_files/**" # optional; skip rule for these paths
```

- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.

**Behavior:** The block of lines after the first `#` heading and before the next heading (any level) may only contain blank lines, list items that are anchor links (e.g. `- [Section](#section)` or `1. [Section](#section)`), badge lines (e.g. `[![alt](url)](url)`), and HTML comments.
Any other line (prose, code blocks, etc.) is reported.

### `no-empty-heading`

**File:** `no-empty-heading.js`

**Description:** Every H2+ heading must have a configurable minimum number of lines of content directly under it (before any subheading).
Content under subheadings does not count.
By default prose and lines inside fenced code blocks (``` or ~~~) count; blank lines, HTML-comment-only lines, and HTML-tag-only lines do not.
You can optionally count any of those.
Optionally exclude files by path (e.g. index-style pages) or allow a section via the exact suppress comment on its own line.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `no-empty-heading`:

```yaml
no-empty-heading:
  minimumContentLines: 1             # optional; default 1
  countBlankLinesAsContent: false   # optional; default false
  countHTMLCommentsAsContent: false # optional; default false
  countHtmlLinesAsContent: false    # optional; default false
  countCodeBlockLinesAsContent: true # optional; default true
  allowList:                        # optional; headings with these titles may be empty
    - "Overview"
    - "Summary"
  stripNumberingForAllowList: true  # optional; default true; strip numbering before allowList match
  excludePathPatterns:
    - "**/*_index.md"               # optional; skip rule for these paths
```

- **`minimumContentLines`** (number, default `1`): Minimum number of lines that must count as content directly under each H2+ heading.
  Must be >= 1; invalid values fall back to 1.
- **`countBlankLinesAsContent`** (boolean, default `false`): If `true`, blank lines count toward the minimum content lines.
- **`countHTMLCommentsAsContent`** (boolean, default `false`): If `true`, lines that are only an HTML comment (other than the suppress comment) count toward the minimum.
  The suppress comment `<!-- ................ ..... -->` never counts as content.
- **`countHtmlLinesAsContent`** (boolean, default `false`): If `true`, lines that are only an HTML tag (e.g. `<br>`, `<div>...</div>`) count toward the minimum.
- **`countCodeBlockLinesAsContent`** (boolean, default `true`): If `false`, lines inside fenced code blocks (` ``` `or `~~~`) do not count toward the minimum.
  When `true`, they do (default).
- **`allowList`** (array of strings, optional): Exact heading titles (after optional numbering strip) that are allowed to have no direct content.
  Match is case-insensitive and trimmed.
  Same idea as `heading-min-words` allowList.
- **`stripNumberingForAllowList`** (boolean, default `true`): When `true`, leading numbering (e.g. `1.2.3`) is stripped from the heading text before comparing to `allowList`.
- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.

Behavior:

- For each H2-H6 heading, only _direct_ content counts: lines that appear **before** the next heading (any level).
  Content under subheadings does **not** count for the parent heading.
  Which line types count is controlled by the options above (by default: prose and code block lines; blank, HTML-comment, and HTML-tag lines do not).
- **Allow by title:** If `allowList` is set, any H2+ heading whose title (after optional numbering strip) matches an entry (case-insensitive) is allowed to be empty.
- **Suppress per section:** A section is allowed without meeting the minimum if it contains a line that is solely the comment `<!-- no-empty-heading allow -->` (optional whitespace around or inside the comment).
  The comment must be on its own line.
    No other HTML comment format suppresses the rule.
- When the file path matches any of `excludePathPatterns`, the rule is skipped for the whole file.

### `document-length`

**File:** `document-length.js`

**Description:** Disallow documents longer than a configured number of lines.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `document-length`:

```yaml
document-length:
  maximum: 1500 # optional; default 1500
  # excludePathPatterns: ["**/long-docs/**"]  # optional; skip rule for matching paths
```

- **`maximum`** (number, default `1500`): Maximum allowed line count.
  Must be a positive integer.
- **`excludePathPatterns`** (list of strings, default none): Glob patterns for file paths where this rule is skipped.

**Behavior:** When the file has more than `maximum` lines, the rule reports a single error on line 1.
The message includes the actual line count and the maximum and suggests splitting into smaller files.

### `ascii-only`

**File:** `ascii-only.js`

**Description:** Disallow non-ASCII except in configured paths; optional replacement suggestions via `unicodeReplacements`.

**Fixable:** Yes, when a replacement is configured in `unicodeReplacements` (or the default map).
Auto-fix replaces the disallowed character with that replacement.
Not fixable when no replacement is available.

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `ascii-only`:

Example: minimal (default letters plus path/emoji)

```yaml
ascii-only:
  allowedPathPatternsUnicode:
    - "**/README.md" # any non-ASCII allowed in READMEs
  allowedPathPatternsEmoji:
    - "docs/**" # only allowedEmoji in docs/
  allowedEmoji:
    - "✅"
    - "⚠️"
```

Example: extend default allowed characters (e.g. degree sign, or `ń` for Polish)

```yaml
ascii-only:
  allowedUnicode:
    - "°"
    - "ń" # merged with default (é, ï, ñ, ç, etc.)
  # allowedUnicodeReplaceDefault: false  # default; true = use only the list above
```

Example: override default (strict allowlist only)

```yaml
ascii-only:
  allowedUnicode:
    - "°"
    - "→" # only these two allowed in prose
  allowedUnicodeReplaceDefault: true
```

Example: check unicode inside code blocks (e.g. only in `text` and `bash` blocks)

````yaml
ascii-only:
  allowUnicodeInCodeBlocks: false
  disallowUnicodeInCodeBlockTypes:
    - "text"
    - "bash" # ```text and ```bash checked; ```go skipped
````

Example: custom replacement suggestions in error messages

```yaml
ascii-only:
  unicodeReplacements: # object form
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
  allowUnicodeInCodeBlocks: true # default; set false to check fenced blocks
  # disallowUnicodeInCodeBlockTypes: ["text", "bash"]  # when allowUnicodeInCodeBlocks false
  unicodeReplacements:
    "→": "->"
    "—": "-"
```

- **`allowedPathPatternsUnicode`** (list of strings, default none): Glob patterns for files where any non-ASCII is allowed.
- **`allowedPathPatternsEmoji`** (list of strings, default none): Glob patterns for files where only `allowedEmoji` characters are allowed.
- **`allowedEmoji`** (list of strings, default none): Emoji (or other chars) allowed in paths matching `allowedPathPatternsEmoji`; each entry may be multi-codepoint (e.g. ⚠️); all code points are allowed.
- **`allowedUnicode`** (list of single-character strings, optional): Characters allowed in all files (global allowlist).
  By default these **extend** the built-in set of common non-English letters (e.g. é, ï, è, ñ, ç).
  Set **`allowedUnicodeReplaceDefault: true`** to **override** and use only your list (no default set).
- **`allowedUnicodeReplaceDefault`** (boolean, default false): When true, only `allowedUnicode` is used (no built-in default set).
- **`allowUnicodeInCodeBlocks`** (boolean, default true): When true, lines inside fenced code blocks are not checked.
  When false, code blocks are checked (or only those in `disallowUnicodeInCodeBlockTypes` if that list is non-empty).
- **`disallowUnicodeInCodeBlockTypes`** (list of strings, default empty):
  When `allowUnicodeInCodeBlocks` is false, only fenced blocks whose info string (e.g. `text`, `bash`) is in this list are checked; block type is the first word after the opening fence.
  When empty, all code blocks are checked.
- **`unicodeReplacements`** (object or array of [char, replacement], default built-in):
  Map of single Unicode character to suggested ASCII replacement in error messages.
    When omitted, rule uses built-in defaults (arrows, quotes, em dash, <=, >=, \*).

Glob matching supports `**` (any path) and `*` (within a segment).
Paths are normalized (forward slashes, leading `./` removed).
Relative patterns (no leading `/` or `*`) match both path-prefix (e.g. `dev_docs/foo.md`) and mid-path (e.g. absolute paths containing `dev_docs/`).

#### Behavior (`ascii-only`)

- No built-in path or emoji defaults; configure `allowedPathPatternsUnicode`, `allowedPathPatternsEmoji`, and `allowedEmoji` as needed.
- If the file path matches `allowedPathPatternsUnicode`, any non-ASCII is allowed in that file.
- If the file path matches `allowedPathPatternsEmoji`, only characters in `allowedEmoji` (and Unicode variation selectors U+FE00-U+FE0F) are allowed; other non-ASCII is reported per occurrence.
- Characters allowed in all files: the default set (e.g. é, ï, ñ, ç) plus `allowedUnicode` when **extend** (default), or only `allowedUnicode` when `allowedUnicodeReplaceDefault: true`.
- Non-ASCII is detected by code-point iteration (surrogate pairs treated as one character) and compared after NFC normalization.
- **One error per disallowed character:** each violation highlights only that character (range) on the line.
  The detail names the character, its code point (e.g. U+2192), and the suggested replacement when present in `unicodeReplacements`.
- Inline code (backticks) is stripped before scanning.
  Fenced code blocks are skipped by default; set `allowUnicodeInCodeBlocks: false` to check them, and optionally `disallowUnicodeInCodeBlockTypes` to restrict which block types (e.g. `text`, `bash`) are checked.

### `fenced-code-under-heading`

**File:** `fenced-code-under-heading.js`

**Description:** For specified languages (e.g. `go`), every fenced code block must sit under an H2-H6 heading, and each heading may have at most a configured number of such blocks.
Use when docs must group code under clear section headings.

**Configuration:** In `.markdownlint.yml` under `fenced-code-under-heading`:

```yaml
fenced-code-under-heading:
  languages: ["go"]
  minHeadingLevel: 2
  maxHeadingLevel: 6
  maxBlocksPerHeading: 3
  requireHeading: true
  exclusive: false   # when true: at most one block (any language) per heading, and it must be one of languages
  # optional path filters:
  # excludePaths: ["**/README.md"]
  # includePaths: ["**/*.md"]
```

- **`languages`** (array of strings, required): Info strings (e.g. `go`, `bash`) to which the rule applies.
  Only blocks whose first word after the opening fence matches an entry are checked.
- **`minHeadingLevel`** / **`maxHeadingLevel`** (numbers, default 2 and 6): Heading levels that count (e.g. H2-H6).
  Blocks must fall under a heading in this range.
- **`maxBlocksPerHeading`** (number, optional): Maximum fenced blocks of the given languages per heading; excess blocks are reported.
  Only blocks matching `languages` count; other block types are allowed unless `exclusive` is true.
- **`requireHeading`** (boolean, default true): When true, every applicable block must be under a heading; blocks before any heading or after the last heading are reported.
- **`exclusive`** (boolean, default false): When true, at most one fenced code block (of any language) per heading, and that block must be one of the configured languages.
  Replaces the per-language limit with a single-block-per-heading rule.
- **`excludePaths`** / **`includePaths`** (arrays of globs, optional): Path filters; see [Shared Helper](#shared-helper).
  When `includePaths` is set, only those paths are checked; `excludePaths` always skips matching paths.

#### Behavior (`fenced-code-under-heading`)

The rule scans lines for ATX headings and fenced code blocks.
Block type is the first word of the info string (e.g. `go` for ` ```go `).

When **`exclusive`** is false: only blocks whose type is in `languages` are validated; each must have a preceding heading at a level between `minHeadingLevel` and `maxHeadingLevel`.
If `maxBlocksPerHeading` is set, each heading is allowed only that many blocks of the given languages (other languages do not count).

When **`exclusive`** is true: every fenced block is considered; each heading may have at most one block total, and that block must be one of the configured languages.
Multiple blocks of any type, or a single block not in `languages`, are reported.

### `heading-min-words`

**File:** `heading-min-words.js`

**Description:** Headings at or below a given level must have at least N words (after optional stripping of numbering).
Use when you want to avoid single-word or empty-looking headings (e.g. "Overview" alone).

**Configuration:** In `.markdownlint.yml` under `heading-min-words`:

```yaml
heading-min-words:
  minWords: 2
  applyToLevelsAtOrBelow: 4
  # optional:
  # minLevel: 1
  # maxLevel: 6
  # excludePaths: ["**/README.md"]
  # includePaths: ["**/*.md"]
  # allowList: ["Overview", "Summary"]
  # stripNumbering: true
```

- **`minWords`** (number, required): Minimum word count per heading (split on whitespace; empty segments ignored).
- **`applyToLevelsAtOrBelow`** (number, required): Apply to headings at this level or deeper (e.g. 4 = H1-H4).
- **`minLevel`** / **`maxLevel`** (numbers, optional): Only headings in this level range are checked (default 1-6).
- **`excludePaths`** / **`includePaths`** (arrays of globs, optional): Path filters; when `includePaths` is set, only those paths are checked.
- **`allowList`** (array of strings, optional): Exact heading titles (after stripping numbering if enabled) that are allowed even if below `minWords`.
- **`stripNumbering`** (boolean, default true): When true, leading numbering (e.g. `1.2.3`) is stripped before counting words and checking allowList.

#### Behavior (`heading-min-words`)

For each ATX heading in the level range, the title is normalized (optional numbering stripped, then split on whitespace).
If the resulting word count is less than `minWords` and the title is not in `allowList`, the rule reports an error.
Path filters apply before any check.

### `heading-title-case`

**File:** `heading-title-case.js`

**Description:** Enforce AP-style (Associated Press) headline capitalization for headings.
Words inside backticks are not checked.
A configurable set of minor words (e.g. "vs", "and", "the", "is") stay lowercase except when they are the first word, last word, or the first word after a colon or after `(` / `[`.

**Fixable:** Yes.
Auto-fix corrects each violating word to AP title case (lowercase or capitalize per AP rules).

**Configuration:** In `.markdownlint.yml` (or `.markdownlint.json`) under `heading-title-case`:

```yaml
heading-title-case:
  lowercaseWords: # optional; extends default list (add words)
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
- **Phase labels:** A single letter immediately after the word "Phase" (e.g. `Phase A:`, `Phase B`) is treated as a label and kept capitalized, so the article "a" in the default list does not force lowercase in that context.
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

**Description:** Enforces structure and consistency of numbered headings: segment count by numbering root; numbering sequential within each section; period style consistent within section; optional max segment value and max heading level.

**Fixable:** Yes, for wrong sequence, missing number prefix, wrong segment count, and period style inconsistency.
Auto-fix replaces or inserts the correct number prefix (and period) to match sibling order and section style.
Not fixable: max segment value exceeded, max heading level (structural).

**Configuration:** In `.markdownlint.yml` under `heading-numbering` (all optional):

```yaml
heading-numbering:
  maxHeadingLevel: 4
  maxSegmentValue: 99
  maxSegmentValueMinLevel: 2
  maxSegmentValueMaxLevel: 4
```

- **`maxHeadingLevel`** (number, optional): Only headings at this level or lower are validated (e.g. 4 = H1-H4); deeper headings are ignored.
- **`maxSegmentValue`** (number, optional): When set, each segment in a numeric prefix must be <= this value (e.g. 99 disallows `100.0`).
- **`maxSegmentValueMinLevel`** / **`maxSegmentValueMaxLevel`** (numbers, optional): Level range to which `maxSegmentValue` applies (default all levels).

#### Behavior (`heading-numbering`)

1. **Segment count by numbering root:** For each heading with a numeric prefix (e.g. `### 1.2 Title`), the number of segments (split on `.`) must equal heading level minus the numbering root level.
   The numbering root is the nearest ancestor heading that has no numbering (or document root, level 1).
   Example: H2 under doc root -> 1 segment; H3 under unnumbered `## Section` -> 1 segment; H4 under `### 1. First` -> 1 segment.
   Headings without a numeric prefix are ignored.
2. **Section-scoped consistency:** For each section (siblings under the same parent), if any sibling has numbering then all siblings at that level must be numbered sequentially and use consistent period style (all `## 1. Title` or all `## 1 Title`).
   **Index base:** Default is 1-based (e.g. 1., 2., 3.).
    If the first numbered sibling in a section has last segment `0` (e.g. `0.`, `0.0.`, `1.0.`), that section is treated as 0-based (0., 1., 2. or 0.0., 0.1., etc.) and no sequence error is reported.
   Unnumbered siblings in a numbered section are reported.
3. **Max heading level:** If `maxHeadingLevel` is set, only headings at that level or lower are checked; deeper headings are skipped.
4. **Max segment value:** If `maxSegmentValue` is set, each numeric segment (in the level range when min/max level options are set) must be <= that value.

### `one-sentence-per-line`

**File:** `one-sentence-per-line.js`

**Description:** Enforce one sentence per line in prose and list content.
Lines with multiple sentences are reported; the rule skips fenced code, front matter, link-reference definitions, table rows, ATX headings, thematic breaks, and blank lines.
Sentence boundaries are detected conservatively: periods/question marks/exclamation followed by space, while avoiding decimals (e.g. `3.14`), common abbreviations (e.g. `e.g.`, `i.e.`), and content inside inline code or link text.

**Fixable:** Yes.
One violation per line with multiple sentences; fix splits all sentences in one pass (newline + continuation indent per sentence).
When the base line has no leading indent, continuation lines have no indent.
List items use list-body indent for continuation; indented paragraphs use configurable `continuationIndent`.

**Configuration:** In `.markdownlint.yml` under `one-sentence-per-line` (all optional):

```yaml
one-sentence-per-line:
  continuationIndent: 4
  # strictAbbreviations: ["e.g", "i.e", "etc"]
  # excludePathPatterns: ["**/README.md"]
```

- **`continuationIndent`** (number, default 4): Spaces for continuation lines when the paragraph is indented; when the base line has no leading indent, continuation lines have no indent (0).
  List items always use list-body indent.
- **`strictAbbreviations`** (array of strings, optional): Abbreviations that do not end a sentence (no trailing period in value, e.g. `e.g`).
  When set, replaces the built-in set; when omitted, the rule uses a default set (e.g., i.e., etc., Dr., Mr., U.S., ...).
- **`excludePathPatterns`** (array of globs, optional): Skip this rule for matching file paths.

#### Behavior (`one-sentence-per-line`)

- **Prose lines:** The rule iterates only over "prose" lines: outside fenced code, outside front matter (YAML between `---` at start of file), and skips link-reference definitions, table rows (two consecutive lines with `|`), ATX headings, thematic breaks, and blank lines.
- **List/paragraph context:** For each prose line, leading indent and list markers (numbered `1.`, bullet `-`/`*`/`+`) are detected; continuation lines use the same indent as the list body (or `continuationIndent` for paragraphs).
- **Sentence detection:** Content is scanned after stripping inline code; bracket and parenthesis depth (e.g. links) are ignored for sentence-end detection.
  A period/question/exclamation is only a sentence end when followed by at least one space (or EOL); e.g. filenames like `file.name` or `config.json` do not trigger a split.
  After optional closing quotes, a period followed by space then a letter/digit is a candidate; it is skipped when the preceding token is a decimal digit or a known abbreviation (including "e.g." when the next token is "g" etc.).

## Shared Helper

`utils.js` is not a rule; it provides utilities used by all custom rules in this repo.
Do not list it in `customRules` in `.markdownlint-cli2.jsonc`.
When reusing any rule, copy `utils.js` into your `.markdownlint-rules` (see [Reusing These Rules](#reusing-these-rules)).

**All custom rules in this repo depend on `utils.js`** (for `pathMatchesAny` and/or other helpers): allow-custom-anchors, ascii-only, document-length, fenced-code-under-heading, heading-min-words, heading-numbering, heading-title-case, no-duplicate-headings-normalized, no-empty-heading, no-heading-like-lines, no-tables, no-h1-content, one-sentence-per-line.

**All custom rules accept `excludePathPatterns`** (optional list of glob patterns).
When the file path matches any pattern, the rule is skipped for that file.
This uses `pathMatchesAny` from `utils.js`.

- **HTML comment suppress:** `isRuleSuppressedByComment(lines, lineNumber, ruleName)` - returns true when the line or the previous line contains `<!-- ruleName allow -->` (used by all rules for per-line override).
  Also accepts markdownlint's cleared form (comment body replaced with dots).

- **Heading and content:** `extractHeadings`, `iterateNonFencedLines`, `iterateProseLines`, `stripInlineCode`, `parseHeadingNumberPrefix`, `normalizeHeadingTitleForDup`, `normalizedTitleForDuplicate`, `RE_ATX_HEADING`, `RE_NUMBERING_PREFIX`.
- **Path/glob matching:** `globToRegExp`, `matchGlob`, `pathMatchesAny` - used for `excludePathPatterns` and other path options (e.g. ascii-only `allowedPathPatternsUnicode`).
  Supports `**` and `*`; paths normalized to forward slashes; relative patterns match path prefix or mid-path.
- **Fence parsing:** `parseFenceInfo`, `iterateLinesWithFenceInfo` - used to detect fenced code block type (e.g. ascii-only skips content; fenced-code-under-heading finds blocks by language).
