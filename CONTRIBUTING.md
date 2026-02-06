# Contributing

Thanks for your interest in contributing. This project uses standard GitHub flow: open an issue or pull request from a fork.

## Before You Submit

### Install Dependencies

```bash
npm install
```

### Run the Same Checks as CI

Run the Makefile targets below so your PR stays green.

## Checks - Makefile Targets

These targets mirror the GitHub Actions workflows. Run them locally before pushing.

### Lint Rule JavaScript (`make lint-js`)

- Lints `.markdownlint-rules/*.js` with ESLint (recommended + complexity/max-lines).
- Same as the [JS Lint](.github/workflows/js-lint.yml) workflow.

  ```bash
  make lint-js
  ```

  Optional: limit to specific paths:

  ```bash
  make lint-js PATHS=".markdownlint-rules/heading-title-case.js,.markdownlint-rules/utils.js"
  ```

### Markdownlint Tests (`make test-markdownlint`)

- **Positive test**: `md_test_files/positive.md` must pass markdownlint (0 errors).
- **Negative tests**: each `md_test_files/negative_*.md` file must **fail** markdownlint; the test suite fails if any negative file passes.
- Same behavior as the [Markdownlint tests](.github/workflows/markdownlint-tests.yml) workflow.

  ```bash
  make test-markdownlint
  ```

  When adding or changing a custom rule, add or update a `negative_*.md` fixture so the intended violation is covered. See [md_test_files/README.md](md_test_files/README.md) for which file exercises which rule.

### Rule Unit Tests (`make test-rules`)

- Unit tests for each custom rule in `test/markdownlint-rules/*.test.js` (Node built-in test runner).
- Same as the [Rule unit tests](.github/workflows/rule-unit-tests.yml) workflow.

  ```bash
  make test-rules
  ```

#### Rule Security Tests

- **Security tests** (`test/markdownlint-rules/security.test.js`): assert that invalid or malformed regex in rule config does not throw (defensive parsing).
  A skipped test documents ReDoS risk when rules use user-controlled regex; enable it after adding mitigation (e.g. safe-regex or timeout).
- **Security lint**: `eslint-plugin-security` is enabled for `.markdownlint-rules` (via `make lint-js`) and forbids `eval`, `new Function`, `child_process`, non-literal `require`/`fs`/`Buffer`, and similar.

These execute as part of `make test-rules` and `make lint-js` respectively.
`make ci` includes these in all the checks it executes.

### Python Unit Tests (`make test-python`)

- Unit tests for `test-scripts/` in `test-scripts/test_*.py` (unittest).
- Same as the [Python tests](.github/workflows/python-tests.yml) workflow.

  ```bash
  make test-python
  ```

### Lint READMEs (`make lint-readmes`)

- Lints all `**/README.md` files with markdownlint (including custom rules).
- Same as the [Lint READMEs](.github/workflows/lint-readmes.yml) workflow.

  ```bash
  make lint-readmes
  ```

  Requires `markdownlint-cli2` on your path (e.g. from `npm install` in this repo, or install globally).

## Recommended Pre-Push

Run all CI checks (same as GitHub Actions):

```bash
make ci
```

Or run individual targets: `make lint-js && make test-rules && make test-markdownlint && make lint-python && make test-python && make lint-readmes`

## Custom Rules

- Rule code lives in [.markdownlint-rules/](.markdownlint-rules/). Do not register `utils.js` as a rule; it is a shared helper.
- Config for custom rules is in [.markdownlint.yml](.markdownlint.yml). Rule docs and reuse instructions are in [.markdownlint-rules/README.md](.markdownlint-rules/README.md).

## Sync Notes

The Makefile comments state that `lint-js`, `test-markdownlint`, `test-rules`, `test-python`, and `lint-readmes` must be kept in sync with their respective workflows.
If you change what gets run in CI, update the corresponding Makefile target and the `ci` target so local `make ci` matches.
