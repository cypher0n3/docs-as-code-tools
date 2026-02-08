"use strict";

/**
 * markdownlint rule: disallow documents longer than a configured number of lines.
 * Reports a single error on line 1 when the file exceeds the maximum.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const raw = params.config?.maximum;
  const maximum =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1 ? raw : 1500;

  if (lines.length <= maximum) {
    return;
  }

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
