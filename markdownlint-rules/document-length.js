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
  const maximum = getMaximum(block, params.config);
  if (lines.length <= maximum) return;
  if (isRuleSuppressedByComment(lines, 1, "document-length")) return;

  onError({
    lineNumber: 1,
    detail: `Document has ${lines.length} lines (maximum ${maximum}). Consider splitting into smaller files.`,
    context: lines[0] ?? "",
  });
}

module.exports = {
  names: ["document-length"],
  description: "Disallow documents longer than a configured number of lines",
  tags: ["length"],
  function: ruleFunction,
};
