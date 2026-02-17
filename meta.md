# Meta.Md - Repository Metadata for AI Agents

- [What This Repo Is](#what-this-repo-is)
- [Conventions (Follow These)](#conventions-follow-these)
- [Layout (Important Paths)](#layout-important-paths)
- [Make Targets (Use These)](#make-targets-use-these)
- [Adding or Changing a Custom Rule](#adding-or-changing-a-custom-rule)
- [`expected_errors.yml` Format](#expected_errorsyml-format)
- [Dependencies](#dependencies)
- [References](#references)

## What This Repo Is

This file gives key information and concrete instructions for working with this repo.
Prefer it over guessing.

- **Docs-as-code tools**: custom [markdownlint](https://github.com/DavidAnson/markdownlint) rules (JavaScript) for linting Markdown.
  Rules live in `markdownlint-rules/` and are intended to be **copied** into other repos (no npm dependency on this repo).
- **Supporting code**: Python scripts in `test-scripts/` for fixture verification and fix tests.
  Node unit tests in `test/markdownlint-rules/`.
- **Config**: `.markdownlint.yml`, `.markdownlint-cli2.jsonc`, `eslint.config.cjs`, `.pylintrc`, `.flake8`, `.editorconfig`.

## Conventions (Follow These)

- **Use Make targets** for all checks and tests.
  Do **not** run scripts directly (e.g. do not run `python3 test-scripts/verify_markdownlint_fixtures.py`; use `make test-markdownlint`).
- **Do not modify the Makefile** unless explicitly directed.
- **Output reports** to the `dev_docs/` directory at repo root (create it if needed).
- **Temporary files** go in the `tmp/` directory at repo root (create it if needed).
- **Touch new files** before editing them.
- **Linting**: Obey linter rules for the relevant language (including Markdown line spacing).
  Run `make lint-js` and `make lint-python` (and `make lint-readmes` for Markdown) as appropriate.
- **Linting/code standards**: Do not change linting or code-checking standards without express user direction.
- **Suppressing checks**: Ask the user before attempting to suppress any check in code.
- **Make over CLI**: Prefer `make` targets over direct CLI tool calls.
  Most tools you need are available via make targets.
- **Makefile edits**: Do not modify Makefile(s) without express user direction.

## Layout (Important Paths)

- **`markdownlint-rules/*.js`** - Custom rule implementations.
  Do **not** register `utils.js` as a rule; it is a shared helper.
- **`markdownlint-rules/README.md`** - Rule docs and reuse instructions.
- **`md_test_files/`** - Fixtures: `positive_*.md` (must pass), `negative_*.md` (must fail with expected errors).
- **`md_test_files/expected_errors.yml`** - Expected errors per fixture (required for `make test-markdownlint`).
- **`test/markdownlint-rules/*.test.js`** - Node unit tests for each rule.
  Run via `make test-rules` or `make test-rules-coverage`.
- **`test-scripts/`** - Python: `verify_markdownlint_fixtures.py` (used by `make test-markdownlint`), `test_*.py` (unit + fix tests).
  Run via `make test-markdownlint`, `make test-python`, `make test-markdownlint-fix`.
- **`.github/workflows/`** - CI workflows.
  Keep Makefile targets in sync with these (see Makefile comments).

## Make Targets (Use These)

Review the available Makefile(s) in the repo for valid make targets.
Use those targets instead of invoking tools directly.

## Adding or Changing a Custom Rule

1. **Implement** in `markdownlint-rules/<rule-name>.js`.
   Depend on `utils.js` if needed; do not register `utils.js`.
   Any rule that can fix violations must include `fixInfo` for `--fix` and VS Code auto-fix support.
2. **Register** in `.markdownlint-cli2.jsonc` (`customRules` / `customRulePaths`) and configure in `.markdownlint.yml` if the rule has options.
3. **Unit test:** add or update `test/markdownlint-rules/<rule-name>.test.js`.
   Run `make test-rules` and `make test-rules-coverage`.
4. **Fixtures:** add or update `md_test_files/negative_<topic>.md` (and `positive_*.md` if needed).
   Update `md_test_files/expected_errors.yml` with `errors` (each: `line`, `rule`; prefer `column` and `message_contains` when the rule supports them).
   See `md_test_files/README.md` for which file exercises which rule.
5. **Fix support:** if the rule is fixable, add/update a test in `test-scripts/test_fix_<rule>.py` that runs `markdownlint-cli2 --fix` and asserts file content.
   Run `make test-markdownlint-fix` and `make test-python`.
6. **Docs:** update `markdownlint-rules/README.md` (rule list and config).
   Run `make lint-readmes`.

## `expected_errors.yml` Format

One entry per fixture file; key = filename (e.g. `negative_heading_like.md`).

Each entry:

```yaml
filename:
  errors:
    - line: <number>
      rule: <rule-id>
      # prefer when rule supports: column, message_contains
```

Total expected error count = length of `errors`.
Fixture verifier (used by `make test-markdownlint`) validates actual markdownlint output against this.

## Dependencies

- **Node.js and npm:** required for lint-js, test-rules, test-markdownlint, markdownlint-cli2.
  Run `npm install` once.
- **Python 3:** required for test-scripts and `make lint-python`.
  For Python lint tooling run `make venv` once.

## References

- **User-facing docs:** [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md).
- **Rule reuse and config:** [markdownlint-rules/README.md](markdownlint-rules/README.md).
- **Fixtures and expectations:** [md_test_files/README.md](md_test_files/README.md).
- **Test scripts:** [test-scripts/README.md](test-scripts/README.md).
