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

### Lint READMEs (`make lint-readmes`)

- Lints all `**/README.md` files with markdownlint (including custom rules).
- Same as the [Lint READMEs](.github/workflows/lint-readmes.yml) workflow.

  ```bash
  make lint-readmes
  ```

  Requires `markdownlint-cli2` on your path (e.g. from `npm install` in this repo, or install globally).

## Recommended Pre-Push

Run all checks:

```bash
make lint-js && make test-markdownlint && make lint-readmes
```

## Custom Rules

- Rule code lives in [.markdownlint-rules/](.markdownlint-rules/). Do not register `utils.js` as a rule; it is a shared helper.
- Config for custom rules is in [.markdownlint.yml](.markdownlint.yml). Rule docs and reuse instructions are in [.markdownlint-rules/README.md](.markdownlint-rules/README.md).

## Sync Notes

The Makefile comments state that `lint-js`, `test-markdownlint`, and `lint-readmes` must be kept in sync with their respective workflows. If you change what gets run in CI, update the corresponding Makefile target so local `make` matches.
