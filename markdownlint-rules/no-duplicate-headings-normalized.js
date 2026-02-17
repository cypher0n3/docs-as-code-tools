"use strict";

const {
  extractHeadings,
  isRuleSuppressedByComment,
  normalizedTitleForDuplicate,
  pathMatchesAny,
} = require("./utils.js");

function shouldSkipByPath(filePath, block) {
  const excludePatterns = block.excludePathPatterns;
  return Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns);
}

function buildByNormalizedMap(headings) {
  const byNormalized = new Map();
  for (const h of headings) {
    const key = normalizedTitleForDuplicate(h.rawText);
    if (!key) continue;
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key).push(h);
  }
  return byNormalized;
}

function reportDuplicateGroups(byNormalized, lines, onError) {
  for (const [normTitle, group] of byNormalized) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.lineNumber - b.lineNumber);
    const first = group[0];
    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      if (isRuleSuppressedByComment(lines, dup.lineNumber, "no-duplicate-headings-normalized")) continue;
      onError({
        lineNumber: dup.lineNumber,
        detail: `Duplicate heading title "${normTitle}" (same normalized text as line ${first.lineNumber}). Each heading must have a unique title after stripping numbering and normalizing.`,
        context: lines[dup.lineNumber - 1],
      });
    }
  }
}

/**
 * markdownlint rule: disallow duplicate heading titles after stripping numbering
 * and normalizing (trim, collapse whitespace, lowercase). Reports each duplicate
 * with a reference to the first occurrence.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const filePath = params.name || "";
  const block = params.config?.["no-duplicate-headings-normalized"] ?? params.config ?? {};
  if (shouldSkipByPath(filePath, block)) return;

  const headings = extractHeadings(params.lines);
  const byNormalized = buildByNormalizedMap(headings);
  reportDuplicateGroups(byNormalized, params.lines, onError);
}

module.exports = {
  names: ["no-duplicate-headings-normalized"],
  description:
    "Disallow duplicate heading titles after stripping numbering and normalizing.",
  tags: ["headings"],
  function: ruleFunction,
};
