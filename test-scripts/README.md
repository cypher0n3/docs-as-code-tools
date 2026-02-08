# Test Scripts

This directory contains Python scripts used to support this repository's test suite and development workflow.

## Scripts

- `verify_markdownlint_fixtures.py`
  - Verifies markdownlint test fixtures in `md_test_files/` against expectations in `md_test_files/expected_errors.yml`.
  - Positive fixtures (`positive_*.md`) must pass with zero errors; negative fixtures (`negative_*.md`) must fail with the errors listed in `expected_errors.yml`.
  - Used by `make test-markdownlint` and the `markdownlint-tests` GitHub Actions workflow.
- `test_verify_markdownlint_fixtures.py`
  - Unit tests for the fixture verifier (run via `make test-python`).

## Requirements

- Python 3
- Node.js and npm (the verifier runs `markdownlint-cli2` via the repo's `node_modules` or `npx`)

## Usage

- Run the markdownlint fixture suite:

  `make test-markdownlint`

  Use `VERBOSE=1` to print each fixture as it is verified: `make test-markdownlint VERBOSE=1`.

- Run Python unit tests (test-scripts/test_*.py):

  `make test-python`

- Run Python linting for these scripts:

  `make lint-python`

## Lint Tooling

Python lint tooling is listed in `test-scripts/requirements-lint.txt`.
You can install it into a local venv with:

`make venv`
