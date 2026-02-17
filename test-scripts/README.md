# Test Scripts

- [Scripts](#scripts)
- [Requirements](#requirements)
- [Usage](#usage)
- [Lint Tooling](#lint-tooling)

## Scripts

This directory contains Python scripts used to support this repository's test suite and development workflow.

- `verify_markdownlint_fixtures.py`
  - Verifies markdownlint test fixtures in `md_test_files/` against expectations in `md_test_files/expected_errors.yml`.
  - Positive fixtures (`positive_*.md`) must pass with zero errors; negative fixtures (`negative_*.md`) must fail with the errors listed in `expected_errors.yml`.
  - Used by `make test-markdownlint` and the `markdownlint-tests` GitHub Actions workflow.
- `test_verify_markdownlint_fixtures.py`
  - **Unit tests** for the fixture verifier (parsing, expectations, etc.).
    Run via `make test-python`.
- **Functional tests** (exercise markdownlint rules; require Node.js and markdownlint-cli2):
  - **Rule-options tests** - `test_markdownlint_options.py` uses the config helper to run markdownlint with temp configs and assert rule behavior.
    Run via `make test-markdownlint-options`.
  - **Fix tests** - one script per custom rule with `fixInfo`; each runs markdownlint then `--fix` and asserts file content.
    Run via `make test-markdownlint-fix`.
    - `test_fix_ascii_only.py` - ascii-only
    - `test_fix_heading_numbering.py` - heading-numbering
    - `test_fix_heading_title_case.py` - heading-title-case
    - `test_fix_no_heading_like_lines.py` - no-heading-like-lines
    - `test_fix_one_sentence_per_line.py` - one-sentence-per-line
- `markdownlint_config_helper.py`
  - Shared helper for functional tests: creates an alternate markdownlint config (in a temp dir), runs markdownlint with that config, then cleans up.
    Use `temp_markdownlint_config(overrides)` or `run_markdownlint_with_config(overrides, paths, fix=...)` to exercise rule options without modifying the repo config.

## Requirements

- Python 3
- `Node.js` and npm (the verifier runs `markdownlint-cli2` via the repo's `node_modules` or `npx`)

## Usage

- Run the markdownlint fixture suite:

  `make test-markdownlint`

  Use `VERBOSE=1` to print each fixture as it is verified: `make test-markdownlint VERBOSE=1`.

- Run **Python unit tests** (verifier logic only; test_verify_*.py):

  `make test-python`

- Run **functional tests** that exercise markdownlint rules (require Node.js):

  - Rule-options: `make test-markdownlint-options`
  - Fix tests: `make test-markdownlint-fix`

- Run Python linting for these scripts:

  `make lint-python`

## Lint Tooling

Python lint tooling is listed in `test-scripts/requirements-lint.txt`.
You can install it into a local venv with:

`make venv`
