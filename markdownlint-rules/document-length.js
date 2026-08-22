"use strict";

const { isRuleSuppressedByComment, pathMatchesAny } = require("./utils.js");

function getBlock(params) {
  return params.config?.["document-length"] ?? params.config ?? {};
}

function shouldSkipByPath(filePath, block) {
  const excludePatterns = block.excludePathPatterns;
  return Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns);
}

function getMaximum(block, fullConfig) {
  const raw = block.maximum ?? fullConfig?.maximum;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 ? raw : 1500;
}

/**
 * markdownlint rule: disallow documents longer than a configured number of lines.
 * Reports a single error on line 1 when the file exceeds the maximum.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const filePath = params.name || "";
  const block = getBlock(params);
  if (shouldSkipByPath(filePath, block)) return;

  const lines = params.lines;
  // A well-formed file ends with a trailing newline, which produces one
  // extra empty trailing entry in params.lines (splitting "a\nb\n" yields
  // ["a", "b", ""]) - that phantom line is not real document content and
  // must not count toward the limit, or a file at exactly the maximum
  // (by any normal line-count tool, e.g. `wc -l`) is falsely flagged as
  // one line over.
  const lineCount = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  const maximum = getMaximum(block, params.config);
  if (lineCount <= maximum) return;
  if (isRuleSuppressedByComment(lines, 1, "document-length")) return;

  onError({
    lineNumber: 1,
    detail: `Document has ${lineCount} lines (maximum ${maximum}). Consider splitting into smaller files.`,
    context: lines[0] ?? "",
  });
}

module.exports = {
  names: ["document-length"],
  description: "Disallow documents longer than a configured number of lines",
  tags: ["length"],
  function: ruleFunction,
};
