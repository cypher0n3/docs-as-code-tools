"use strict";

const {
  extractHeadings,
  normalizedTitleForDuplicate,
} = require("./utils.js");

/**
 * markdownlint rule: disallow duplicate heading titles after stripping numbering
 * and normalizing (trim, collapse whitespace, lowercase). Reports each duplicate
 * with a reference to the first occurrence.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
    const headings = extractHeadings(params.lines);
    const byNormalized = new Map();

    for (const h of headings) {
      const key = normalizedTitleForDuplicate(h.rawText);
      if (!key) {
        continue;
      }
      if (!byNormalized.has(key)) {
        byNormalized.set(key, []);
      }
      byNormalized.get(key).push(h);
    }

    for (const [normTitle, group] of byNormalized) {
      if (group.length <= 1) {
        continue;
      }
      group.sort((a, b) => a.lineNumber - b.lineNumber);
      const first = group[0];
      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        onError({
          lineNumber: dup.lineNumber,
          detail: `Duplicate heading title "${normTitle}" (same normalized text as line ${first.lineNumber}). Each heading must have a unique title after stripping numbering and normalizing.`,
          context: params.lines[dup.lineNumber - 1],
        });
      }
    }
  }

module.exports = {
  names: ["no-duplicate-headings-normalized"],
  description:
    "Disallow duplicate heading titles after stripping numbering and normalizing.",
  tags: ["headings"],
  function: ruleFunction,
};
