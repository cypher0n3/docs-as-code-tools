.PHONY: ci lint-js lint-readmes lint-python test-markdownlint test-python test-python-coverage test-rules test-rules-coverage venv

# Run all CI checks (same as GitHub Actions workflows). Run after 'npm install' and optionally 'make venv'.
ci: lint-js test-rules-coverage test-markdownlint lint-python test-python-coverage test-python lint-readmes

# README linting - performs same checks as GitHub Actions workflow
# NOTE: This target must be kept in sync with .github/workflows/lint-readmes.yml.
#       When adding or modifying README linting, update both this Makefile and
#       the workflow file to ensure local 'make lint-readmes' matches CI behavior.
lint-readmes:
	@command -v node >/dev/null 2>&1 || { \
		echo "Error: node not found. Install Node.js to run README linting."; \
		exit 1; \
	}
	@if [ -x "$(CURDIR)/node_modules/.bin/markdownlint-cli2" ]; then \
		MDL="$(CURDIR)/node_modules/.bin/markdownlint-cli2"; \
	elif command -v markdownlint-cli2 >/dev/null 2>&1; then \
		MDL="markdownlint-cli2"; \
	else \
		MDL="npx markdownlint-cli2"; \
	fi; \
	echo "Linting READMEs..."; \
	$$MDL README.md **/README.md markdownlint-rules/README.md CONTRIBUTING.md

# JavaScript linting - performs same checks as GitHub Actions workflow
# NOTE: This target must be kept in sync with .github/workflows/js-lint.yml.
#       When adding or modifying JS linting, update both this Makefile and
#       the workflow file to ensure local 'make lint-js' matches CI behavior.
#       Requires: Node.js and npm; run 'npm install' (or npm ci) once for node_modules.
#       Lints markdownlint-rules/*.js with ESLint (recommended + complexity/max-lines + eslint-plugin-security).
# Usage: make lint-js [PATHS="path1,path2"]
#        - PATHS: Comma-separated list of files/directories (default: markdownlint-rules)
lint-js:
	@command -v node >/dev/null 2>&1 || { \
		echo "Error: node not found. Install Node.js to run JS linting."; \
		exit 1; \
	}
	@if [ -x "$(CURDIR)/node_modules/.bin/eslint" ]; then \
		ESLINT="$(CURDIR)/node_modules/.bin/eslint"; \
	elif command -v eslint >/dev/null 2>&1; then \
		ESLINT="eslint"; \
	else \
		echo "Error: eslint not found. Run 'npm install' in repo root or install globally: npm install -g eslint"; \
		exit 1; \
	fi; \
	if [ -n "$(PATHS)" ]; then \
		LINT_PATHS=$$(echo "$(PATHS)" | tr ',' ' '); \
	else \
		LINT_PATHS="markdownlint-rules"; \
	fi; \
	echo "Running eslint on $$LINT_PATHS..."; \
	$$ESLINT $$LINT_PATHS --ext .js; \
	exit $$?

# Python linting - performs same checks as GitHub Actions workflow
# NOTE: This target must be kept in sync with .github/workflows/python-lint.yml.
#       When adding or modifying Python linting, update both this Makefile and
#       the workflow file to ensure local 'make lint-python' matches CI behavior.
#       Requires: pip install flake8 pylint radon xenon vulture bandit
#       NOTE: This target includes gate-style linting (flake8, pylint, xenon -b C,
#             radon mi fail on rank C) and code smell tooling (radon, vulture, bandit).
#       Xenon (radon-based) fails if any block has cyclomatic complexity > C.
#       Radon mi fails if any module has maintainability index rank C (MI 0-9).
# Usage: make lint-python [PATHS="path1,path2,path3"]
#        - PATHS: Comma-separated list of files/directories to check (default: test-scripts)
lint-python:
	@command -v python3 >/dev/null 2>&1 || { \
		echo "Error: python3 not found. Install Python 3 to run Python linting."; \
		exit 1; \
	}
	@command -v flake8 >/dev/null 2>&1 || [ -x .venv/bin/flake8 ] || { \
		echo "Error: flake8 not found. Install with: pip install flake8 or run 'make venv'"; \
		exit 1; \
	}
	@command -v pylint >/dev/null 2>&1 || [ -x .venv/bin/pylint ] || { \
		echo "Error: pylint not found. Install with: pip install pylint or run 'make venv'"; \
		exit 1; \
	}
	@command -v radon >/dev/null 2>&1 || [ -x .venv/bin/radon ] || { \
		echo "Error: radon not found. Install with: pip install radon or run 'make venv'"; \
		exit 1; \
	}
	@command -v xenon >/dev/null 2>&1 || [ -x .venv/bin/xenon ] || { \
		echo "Error: xenon not found. Install with: pip install xenon or run 'make venv'"; \
		exit 1; \
	}
	@command -v vulture >/dev/null 2>&1 || [ -x .venv/bin/vulture ] || { \
		echo "Error: vulture not found. Install with: pip install vulture or run 'make venv'"; \
		exit 1; \
	}
	@command -v bandit >/dev/null 2>&1 || [ -x .venv/bin/bandit ] || { \
		echo "Error: bandit not found. Install with: pip install bandit or run 'make venv'"; \
		exit 1; \
	}
	@if [ -n "$(PATHS)" ]; then \
		LINT_PATHS=$$(echo "$(PATHS)" | tr ',' ' '); \
	else \
		LINT_PATHS="test-scripts"; \
	fi; \
	if [ -d .venv ]; then PATH="$(CURDIR)/.venv/bin:$$PATH"; export PATH; fi; \
	echo "Running flake8 on Python scripts..."; \
	flake8 $$LINT_PATHS --jobs=1; FLAKE8_RESULT=$$?; \
	echo "Running pylint on Python scripts..."; \
	pylint --rcfile=.pylintrc $$LINT_PATHS; PYLINT_RESULT=$$?; \
	echo "Running radon complexity (non-gating)..."; \
	radon cc -s -a $$LINT_PATHS || true; \
	echo "Running xenon cyclomatic complexity check (fail if any block > C)..."; \
	xenon -b C $$LINT_PATHS; XENON_RESULT=$$?; \
	echo "Running radon maintainability metrics (non-gating)..."; \
	radon mi -s $$LINT_PATHS || true; \
	echo "Running radon maintainability check (fail if any module MI rank C)..."; \
	TMP_MI=$$(mktemp); \
	radon mi -j $$LINT_PATHS -O $$TMP_MI; \
	python3 -c "import sys, json; d=json.load(open(sys.argv[1])); bad=[k for k,v in d.items() if v.get('rank')=='C']; [print('MI rank C (low maintainability):', f) for f in bad]; sys.exit(1 if bad else 0)" $$TMP_MI; \
	MI_RESULT=$$?; rm -f $$TMP_MI; \
	echo "Running vulture unused code detection (non-gating)..."; \
	vulture $$LINT_PATHS --min-confidence 80 || true; \
	echo "Running bandit security scan (non-gating)..."; \
	bandit -r $$LINT_PATHS; BANDIT_RESULT=$$?; \
	echo ""; echo "Lint exit codes: flake8=$$FLAKE8_RESULT pylint=$$PYLINT_RESULT xenon=$$XENON_RESULT radon_mi=$$MI_RESULT bandit=$$BANDIT_RESULT"; \
	[ $$FLAKE8_RESULT -ne 0 ] || [ $$PYLINT_RESULT -ne 0 ] || [ $$XENON_RESULT -ne 0 ] || [ $$MI_RESULT -ne 0 ] || [ $$BANDIT_RESULT -ne 0 ] && exit 1; exit 0

# Unit tests for markdownlint-rules/*.js - same as .github/workflows/rule-unit-tests.yml
# NOTE: Keep in sync with that workflow. Requires: Node.js, npm; run 'npm install' first.
test-rules:
	@command -v node >/dev/null 2>&1 || { \
		echo "Error: node not found. Install Node.js and run npm install."; \
		exit 1; \
	}
	@node --test test/markdownlint-rules/*.test.js

# Unit test coverage for markdownlint-rules/*.js (fails if any file < 90% lines/statements).
# Requires: Node.js, npm; run 'npm install' first.
test-rules-coverage:
	@command -v node >/dev/null 2>&1 || { \
		echo "Error: node not found. Install Node.js and run npm install."; \
		exit 1; \
	}
	@npm run test:rules:coverage

# Markdownlint positive/negative tests - same as .github/workflows/markdownlint-tests.yml
# NOTE: Keep in sync with that workflow. Positive must pass; each negative must fail.
# Requires: Node.js, npm; run 'npm install' or 'npm ci' first.
# VERBOSE=1 prints each fixture as it is verified.
test-markdownlint:
	@command -v node >/dev/null 2>&1 || { \
		echo "Error: node not found. Install Node.js and run npm install."; \
		exit 1; \
	}
	@python3 test-scripts/verify_markdownlint_fixtures.py $(if $(filter 1,$(VERBOSE)),--verbose)

# Python unit tests - same as .github/workflows/python-tests.yml
# NOTE: Keep in sync with that workflow. Requires: Python 3.
test-python:
	@command -v python3 >/dev/null 2>&1 || { \
		echo "Error: python3 not found. Install Python 3 to run tests."; \
		exit 1; \
	}
	@python3 -m unittest discover -s test-scripts -p "test_*.py" -v

# Python unit test coverage - runs tests with coverage, fails if coverage < 90%.
# Requires: pip install coverage (or make venv). Sources: test-scripts/*.py (excl. test_*.py).
test-python-coverage:
	@command -v python3 >/dev/null 2>&1 || { \
		echo "Error: python3 not found. Install Python 3 to run coverage."; \
		exit 1; \
	}
	@command -v coverage >/dev/null 2>&1 || [ -x .venv/bin/coverage ] || { \
		echo "Error: coverage not found. Install with: pip install coverage or run 'make venv'"; \
		exit 1; \
	}
	@if [ -d .venv ]; then PATH="$(CURDIR)/.venv/bin:$$PATH"; export PATH; fi; \
	coverage run -m unittest discover -s test-scripts -p "test_*.py" && \
	coverage report --include="test-scripts/*.py" --omit="test-scripts/test_*.py" --fail-under=90

# Python venv for lint tooling - creates .venv and installs test-scripts/requirements-lint.txt
# Run once (or after adding/updating test-scripts/requirements-lint.txt) so make lint-python uses the venv.
# Usage: make venv
venv:
	@command -v python3 >/dev/null 2>&1 || { \
		echo "Error: python3 not found. Install Python 3 to create the venv."; \
		exit 1; \
	}
	@python3 -m venv .venv
	@.venv/bin/pip install -q --upgrade pip
	@.venv/bin/pip install -q -r test-scripts/requirements-lint.txt
	@echo "Created .venv with lint tooling. Use 'make lint-python' (it will use .venv when present)."
