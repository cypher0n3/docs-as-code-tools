"use strict";

const { extractHeadings, parseHeadingNumberPrefix, pathMatchesAny } = require("./utils.js");

/**
 * Normalize config: minWords required; optional applyToLevelsAtOrBelow, minLevel/maxLevel,
 * excludePaths/includePaths, allowList, stripNumbering.
 *
 * @param {object} raw - Raw config (rule's block)
 * @returns {object} Normalized options
 */
function normalizeConfig(raw) {
  const minWords = typeof raw.minWords === "number" && raw.minWords >= 1 ? raw.minWords : 2;
  const stripNumbering = raw.stripNumbering !== false;
  const allowList = Array.isArray(raw.allowList) ? raw.allowList.map(String) : [];
  const applyToLevelsAtOrBelow = typeof raw.applyToLevelsAtOrBelow === "number" ? raw.applyToLevelsAtOrBelow : null;
  const minLevel = typeof raw.minLevel === "number" ? raw.minLevel : null;
  const maxLevel = typeof raw.maxLevel === "number" ? raw.maxLevel : null;
  return {
    minWords,
    stripNumbering,
    allowList,
    applyToLevelsAtOrBelow,
    minLevel,
    maxLevel,
    excludePaths: raw.excludePaths || raw.excludePathPatterns,
    includePaths: raw.includePaths || raw.includePathPatterns,
  };
}

/**
 * Return true if this heading level is in scope for the min-words check.
 *
 * @param {number} level - Heading level 1-6
 * @param {{ applyToLevelsAtOrBelow: number|null, minLevel: number|null, maxLevel: number|null }} opts
 * @returns {boolean}
 */
function levelInScope(level, opts) {
  if (opts.minLevel != null || opts.maxLevel != null) {
    const min = opts.minLevel != null ? opts.minLevel : 1;
    const max = opts.maxLevel != null ? opts.maxLevel : 6;
    return level >= min && level <= max;
  }
  if (opts.applyToLevelsAtOrBelow != null) {
    return level >= opts.applyToLevelsAtOrBelow;
  }
  return true;
}

/**
 * Get title text for word count: raw heading text, optionally with leading numbering stripped.
 *
 * @param {string} rawText - Full heading text after #
 * @param {boolean} stripNumbering
 * @returns {string}
 */
function getTitleForWordCount(rawText, stripNumbering) {
  if (stripNumbering) {
    const { titleText } = parseHeadingNumberPrefix(rawText);
    return titleText;
  }
  return rawText.trim();
}

/**
 * Count words in title (non-empty tokens separated by whitespace).
 *
 * @param {string} title
 * @returns {number}
 */
function wordCount(title) {
  /* c8 ignore start -- defensive: getTitleForWordCount always returns string */
  if (!title || typeof title !== "string") {
    return 0;
  }
  /* c8 ignore stop */
  const t = title.trim();
  /* c8 ignore next 1 -- empty title branch */
  return t === "" ? 0 : t.split(/\s+/).filter(Boolean).length;
}

function shouldSkipPath(filePath, opts) {
  const includePaths = Array.isArray(opts.includePaths) ? opts.includePaths : [];
  const excludePaths = Array.isArray(opts.excludePaths) ? opts.excludePaths : [];
  if (includePaths.length > 0 && !pathMatchesAny(filePath, includePaths)) return true;
  if (pathMatchesAny(filePath, excludePaths)) return true;
  return false;
}

function isAllowedSingleWord(title, allowList) {
  if (allowList.length === 0) return false;
  const single = title.trim().toLowerCase();
  return allowList.some((a) => a.trim().toLowerCase() === single);
}

/**
 * markdownlint rule: headings at or below a configurable level must have at least N words
 * in the title (after optional numbering strip). Optional allowList for single-word titles.
 *
 * @param {object} params - markdownlint params (lines, config, name)
 * @param {function(object): void} onError - Callback to report an error
 */
// eslint-disable-next-line complexity -- path/config/level/word/allowList branches
function ruleFunction(params, onError) {
  const lines = params.lines;
  const filePath = params.name || "";
  const raw = params.config?.["heading-min-words"] ?? params.config ?? {};
  const opts = normalizeConfig(raw);

  if (shouldSkipPath(filePath, opts)) return;

  const headings = extractHeadings(lines);
  for (const h of headings) {
    if (!levelInScope(h.level, opts)) continue;
    const title = getTitleForWordCount(h.rawText, opts.stripNumbering);
    const count = wordCount(title);
    /* c8 ignore next 2 -- branch: allow by minWords or allowList */
    const allowed = count >= opts.minWords || (count === 1 && isAllowedSingleWord(title, opts.allowList));
    if (allowed) continue;
    onError({
      lineNumber: h.lineNumber,
      detail: `Heading at or below this level must have at least ${opts.minWords} word(s) in the title (found ${count}).`,
      context: lines[h.lineNumber - 1],
    });
  }
}

module.exports = {
  names: ["heading-min-words"],
  description:
    "Headings at or below a configurable level must have at least N words in the title (after optional numbering strip).",
  tags: ["headings"],
  function: ruleFunction,
};
