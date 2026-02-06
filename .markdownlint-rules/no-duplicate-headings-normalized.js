"use strict";

const {
  extractHeadings,
  normalizedTitleForDuplicate,
} = require("./utils.js");

module.exports = {
  names: ["no-duplicate-headings-normalized"],
  description:
    "Disallow duplicate heading titles after stripping numbering and normalizing.",
  tags: ["headings"],
  function: function (params, onError) {
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

    for (const [, group] of byNormalized) {
      if (group.length <= 1) {
        continue;
      }
      group.sort((a, b) => a.lineNumber - b.lineNumber);
      const first = group[0];
      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        onError({
          lineNumber: dup.lineNumber,
          detail: `Duplicate heading title (same as line ${first.lineNumber}). Each heading should have a unique title after stripping numbering.`,
          context: params.lines[dup.lineNumber - 1],
        });
      }
    }
  },
};
