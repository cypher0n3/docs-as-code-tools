# Docs-As-Code Tools

[![CI](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/js-lint.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/js-lint.yml)
[![Lint READMEs](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/lint-readmes.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/lint-readmes.yml)
[![Markdownlint tests](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/markdownlint-tests.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/markdownlint-tests.yml)
[![Rule unit tests](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/rule-unit-tests.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/rule-unit-tests.yml)
[![Python lint](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-lint.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-lint.yml)
[![Python tests](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml/badge.svg?branch=main)](https://github.com/cypher0n3/docs-as-code-tools/actions/workflows/python-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

- [Features](#features)
- [Requirements](#requirements)
- [Install Testing Dependencies](#install-testing-dependencies)
- [Usage](#usage)
- [Repository Layout](#repository-layout)
- [Contributing](#contributing)
- [License](#license)

## Features

Lint and docs-as-code tooling: custom [markdownlint](https://github.com/DavidAnson/markdownlint) rules (JavaScript).

- **Custom markdownlint rules** in [markdownlint-rules/](markdownlint-rules/README.md) (intended to be **copied directly** into whatever repo wishes to use them; no need to depend on this repo).
  Some rules support auto-fix.
  - [allow-custom-anchors.js](markdownlint-rules/allow-custom-anchors.js) - Custom anchor validation.
    - Only allow `<a id="..."></a>` whose ids match configured regex patterns; optional placement (heading match, line match, require-after, max per section).
    - Use when: enforcing stable fragment links (e.g. spec/algo docs) and consistent anchor placement.
  - [ascii-only.js](markdownlint-rules/ascii-only.js) - ASCII-only with path/emoji allowlists.
    - Disallow non-ASCII except in paths matching globs; allow Unicode or emoji-only in specific paths; optional replacement suggestions in errors.
      Fixable when a replacement is configured (default map includes arrows, quotes, em dash).
    - Use when: keeping most docs ASCII while allowing Unicode/emoji only in chosen files (e.g. i18n or release notes).
  - [fenced-code-under-heading.js](markdownlint-rules/fenced-code-under-heading.js) - fenced code under heading.
    - For specified languages (e.g. `go`), every fenced block must sit under an H2-H6 heading; optional max blocks per heading and path filters.
    - Use when: docs must group code under clear section headings.
  - [heading-min-words.js](markdownlint-rules/heading-min-words.js) - minimum words in headings.
    - Headings at or below a level must have at least N words (optional numbering strip, allowList, path filters).
    - Use when: avoiding single-word or empty-looking headings.
  - [heading-numbering.js](markdownlint-rules/heading-numbering.js) - heading numbering.
    - Enforce segment count by numbering root, sequential numbering per section, consistent period style (e.g. `1. Title` vs `1 Title`), optional `maxSegmentValue` and `maxHeadingLevel`.
      Default is 1-based (1., 2., 3.); if the first numbered heading in a section starts at 0 (e.g. `0.`, `0.0.`), that section is treated as 0-based and no error is reported.
    Fixable for wrong sequence, missing prefix, wrong segment count, period style.
    - Use when: docs use numbered headings (e.g. `### 1.2.3 Title` or 0-based `### 0. Introduction`) and you want structure and style consistent.
  - [heading-title-case.js](markdownlint-rules/heading-title-case.js) - heading title case.
    - Enforce title case for headings; words in backticks ignored; configurable lowercase words (e.g. vs, and, the).
      Fixable: corrects each violating word to AP title case.
    - Use when: you want consistent capitalization of headings (first/last and major words capped; small words lowercase in the middle).
  - [no-duplicate-headings-normalized.js](markdownlint-rules/no-duplicate-headings-normalized.js) - duplicate-heading checks.
    - Disallow duplicate heading titles after stripping numeric prefixes and normalizing case/whitespace; first occurrence is reference.
    - Use when: avoiding duplicate section titles that differ only by number or formatting.
  - [no-empty-heading.js](markdownlint-rules/no-empty-heading.js) - H2+ must have content.
    - Every H2+ heading must have a configurable minimum of content lines directly under it (before any subheading); content under subheadings does not count.
      Config: `minimumContentLines`, `countBlankLinesAsContent`, `countHTMLCommentsAsContent`, `countHtmlLinesAsContent`, `countCodeBlockLinesAsContent`, `excludePathPatterns` (e.g. `**/*_index.md`).
      Only `<!-- no-empty-heading allow -->` on its own line suppresses.
    - Use when: avoiding placeholder sections with no body content.
  - [no-heading-like-lines.js](markdownlint-rules/no-heading-like-lines.js) - no heading-like lines.
    - Report lines that look like headings but are not (e.g. `**Text:**`, `1. **Text**`, whole-line emphasis `**Introduction**` / `*Note*`); default omits colon from sentence punctuation so colon lines are caught (greedier than MD036).
      Fixable: default strips emphasis; optional `convertToHeading` converts to ATX heading (context-aware level; optional AP title case and numbering when heading-title-case and heading-numbering are present).
    - Use when: ensuring real Markdown headings instead of bold/italic that look like headings.
  - [no-h1-content.js](markdownlint-rules/no-h1-content.js) - no content under h1 except TOC.
    - Under the first h1, allow only table-of-contents content (blank lines, list-of-links, HTML comments).
    - Use when: enforcing that the only content under the doc title is a TOC.
  - [one-sentence-per-line.js](markdownlint-rules/one-sentence-per-line.js) - one sentence per line.
    - Enforce one sentence per line in prose and list content; skips decimals, abbreviations, inline code, filenames (period with no space after).
      Fixable: splits all sentences on the line in one pass with configurable continuation indent.
    - Use when: keeping prose and list items to one sentence per line for readability and diffs.
  - [document-length.js](markdownlint-rules/document-length.js) - maximum document length.
    - Disallow documents longer than a configured number of lines (default 1500); reports on line 1 when over the limit.
      Optional `excludePathPatterns`.
    - Use when: keeping individual docs under a line cap to encourage splitting.
  - [utils.js](markdownlint-rules/utils.js) - shared utilities
    - Heading/content helpers and path/glob matching; used by other rules.
      Do not register as a rule in markdownlint.
    - Use when: copying the rule files; required by several of the rules above.

- **JS linting** for the rule code: ESLint (recommended + complexity/max-lines + eslint-plugin-security), aligned with the GitHub Actions workflow.
- **Markdownlint fixture tests**: [md_test_files/](md_test_files/README.md) includes `positive_*.md` and `negative_*.md` fixtures with explicit expected errors, verified by `test-scripts/verify_markdownlint_fixtures.py`.
- **Rule unit tests**: Node `node:test` unit tests for each custom rule in `test/markdownlint-rules/` (including security tests for defensive regex handling and ReDoS awareness); run with `make test-rules` or `npm run test:rules`.
  CI runs `make test-rules-coverage` (fails if any rule file is below 90% line/statement coverage).
- **Python unit tests**: `unittest` tests for [test-scripts/](test-scripts/README.md) in `test-scripts/test_*.py`; run with `make test-python`.
  Includes functional fix tests (`test_fix_heading_title_case.py`, `test_fix_ascii_only.py`, `test_fix_heading_numbering.py`, `test_fix_no_heading_like_lines.py`, `test_fix_one_sentence_per_line.py`) and `test_markdownlint_options.py` (rule options via config helper).
- **Python linting** for repo tooling scripts: `make lint-python` (flake8, pylint, xenon/radon, vulture, bandit).

See **[markdownlint-rules/README.md](markdownlint-rules/README.md)** for rule docs and configuration.

## Requirements

- `Node.js` and npm (for JS linting)
- Python 3 (for repo test scripts and `make lint-python`)
- [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) and config (`.markdownlint-cli2.jsonc`, `.markdownlint.yml`) when using the custom rules in another repo

## Install Testing Dependencies

```bash
npm install
```

## Usage

- **Lint the custom rule JavaScript** (same as CI):

  ```bash
  make lint-js
  ```

  Optional: limit paths: `make lint-js PATHS="markdownlint-rules/allow-custom-anchors.js,markdownlint-rules/utils.js"`

- **Run markdownlint fixture tests**:

  ```bash
  make test-markdownlint
  ```

  Use `VERBOSE=1` to print each fixture as it is verified: `make test-markdownlint VERBOSE=1`.

- **Run rule unit tests**:

  ```bash
  make test-rules
  ```

  With coverage (fails if any rule &lt; 90%): `make test-rules-coverage`

- **Run Python unit tests**:

  ```bash
  make test-python
  ```

- **Run all CI checks** (same as GitHub Actions):

  ```bash
  make ci
  ```

  Requires `npm install` and, for Python lint, `make venv`.

- **Lint repo Python scripts**:

  ```bash
  make venv
  make lint-python
  ```

- **Use the custom rules**: Copy the `markdownlint-rules/*.js` files (and optionally the rule [README](markdownlint-rules/README.md) and config) into your docs repo, then point markdownlint-cli2 at that directory and your `.markdownlint.yml` / `.markdownlint-cli2.jsonc`.
  For VS Code (and forks like Cursor), see [markdownlint-rules/README.md](markdownlint-rules/README.md#using-in-vs-code-and-its-forks).
  To auto-fix fixable violations (e.g. heading title case, ascii-only replacements, heading numbering), run `markdownlint-cli2 --fix <paths>` or use the editor "Fix all supported markdownlint violations".

## Repository Layout

- **`.github/`** - [CODEOWNERS](.github/CODEOWNERS) and **workflows/** (CI):
  - [auto-assign.yml](.github/workflows/auto-assign.yml)
  - [js-lint.yml](.github/workflows/js-lint.yml)
  - [lint-readmes.yml](.github/workflows/lint-readmes.yml)
  - [markdownlint-tests.yml](.github/workflows/markdownlint-tests.yml)
  - [rule-unit-tests.yml](.github/workflows/rule-unit-tests.yml)
  - [python-lint.yml](.github/workflows/python-lint.yml)
  - [python-tests.yml](.github/workflows/python-tests.yml)
- **`.vscode/settings.json`** - Editor settings so the markdownlint extension uses this repo's custom rules in VS Code and compatible editors (see [markdownlint-rules/README.md](markdownlint-rules/README.md#using-in-vs-code-and-its-forks)).
- **`.markdownlint-cli2.jsonc`** - markdownlint-cli2 config: custom rule paths, extends `.markdownlint.yml`, ignores.
- **`.markdownlint.yml`** - markdownlint and custom-rule options (e.g. ascii-only, allow-custom-anchors).
- **`CONTRIBUTING.md`** - How to contribute and run tests/linting locally.
- **`eslint.config.cjs`** - ESLint config for `markdownlint-rules/*.js`.
- **`Makefile`** - Local targets (kept in sync with the workflows in `.github/workflows/`).
- **`markdownlint-rules/`** - Custom rule modules (`*.js`) and [README](markdownlint-rules/README.md).
  Copy into other repos as `.markdownlint-rules`; do not register `utils.js`.
- **`md_test_files/`** - Test fixtures: `positive_*.md` (must pass), `negative_*.md` (must fail).
  See [md_test_files/README.md](md_test_files/README.md).
- **`package.json`** - npm dependencies (ESLint, markdownlint-cli2, etc.).
- **`test/markdownlint-rules/`** - Node `node:test` unit tests for each custom rule (`*.test.js`); run with `make test-rules`.
- **`test-scripts/`** - Python scripts used by repo tests and tooling.
  See [test-scripts/README.md](test-scripts/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute, run tests (`make test-markdownlint`, `make test-rules`, `make test-python`), and run linting (`make lint-js`, `make lint-readmes`).
Use `make ci` to run all CI checks locally.

## License

MIT.
See [LICENSE](LICENSE).
