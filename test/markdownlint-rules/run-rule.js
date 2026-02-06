"use strict";

/**
 * Helper for unit-testing markdownlint custom rules: invokes the rule's function
 * with fake params and a callback that collects errors, so tests can assert on
 * line numbers and messages without running markdownlint-cli2.
 *
 * @param {object} ruleModule - Rule module with .function and .names
 * @param {string[]} lines - Document lines
 * @param {object} [config] - Full config (rule reads its key from config)
 * @param {string} [name] - File name for path-based rules (e.g. ascii-only)
 * @returns {{ lineNumber: number, detail: string, context?: string }[]}
 */
function runRule(ruleModule, lines, config = {}, name = "test.md") {
  const errors = [];
  const onError = (e) => errors.push(e);
  ruleModule.function({ lines, config, name }, onError);
  return errors;
}

module.exports = { runRule };
