"use strict";

const {
  extractHeadings,
  parseHeadingNumberPrefix,
  stripInlineCode,
} = require("./utils.js");

/** Default words that stay lowercase in title case (unless first or last word). */
const DEFAULT_LOWERCASE_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "as", "at", "by",
  "for", "in", "of", "on", "to", "vs", "via", "per", "into", "with", "from",
  "into", "than", "when", "if", "unless", "because", "although", "while",
]);

/**
 * Strip leading/trailing punctuation from a word for comparison (e.g. "word," -> "word").
 * @param {string} w
 * @returns {string}
 */
function stripWordPunctuation(w) {
  // Only trim punctuation at the edges so internal punctuation like "Node.js" or "O'Reilly" remains.
  // This ensures words like "(Custom" and "practice)" are evaluated as "Custom" and "practice".
  return w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").trim();
}

/**
 * Check if a word starts with an uppercase letter (A-Z).
 * @param {string} w
 * @returns {boolean}
 */
function startsWithUpper(w) {
  const core = stripWordPunctuation(w);
  const firstAlpha = core.match(/[A-Za-z]/)?.[0];
  return firstAlpha != null && /[A-Z]/.test(firstAlpha);
}

/**
 * Check if a word is all lowercase (ignoring leading/trailing punctuation).
 * @param {string} w
 * @returns {boolean}
 */
function isAllLower(w) {
  const core = stripWordPunctuation(w);
  return core === core.toLowerCase() && /[a-z]/.test(core);
}

/**
 * Validate one word for title case; returns error detail string or null if valid.
 * @param {{ raw: string, core: string, isFirst: boolean, isLast: boolean, lowercaseWords: Set<string> }} opts
 * @returns {string|null}
 */
function checkWord(opts) {
  const { raw, core, isFirst, isLast, lowercaseWords, isSubphraseStart } = opts;
  const coreLower = core.toLowerCase();
  // Parenthetical/bracketed phrases act like a new "sentence start":
  // the first word inside them should be capitalized, even if it's in lowercaseWords.
  const shouldBeLower = !isFirst && !isLast && !isSubphraseStart && lowercaseWords.has(coreLower);
  if (shouldBeLower) {
    return isAllLower(raw) ? null : `"${core}" should be lowercase in title case (middle word).`;
  }
  if (startsWithUpper(raw)) return null;
  const kind = (isFirst || isSubphraseStart) ? "first" : isLast ? "last" : "major";
  return `"${core}" should be capitalized (${kind} word).`;
}

/**
 * Validate title case on a heading's title part (numbering stripped).
 * Words inside backticks are excluded from checking.
 * @param {string} titleText - Title after stripping numbering
 * @param {Set<string>} lowercaseWords - Words that must be lowercase in middle
 * @returns {{ valid: boolean, detail?: string }}
 */
function checkTitleCase(titleText, lowercaseWords) {
  const withCodeStripped = stripInlineCode(titleText);
  const words = withCodeStripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { valid: true };

  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const core = stripWordPunctuation(raw);
    if (!core || !/[a-zA-Z]/.test(core)) continue;

    const firstAlphaIdx = raw.search(/[A-Za-z0-9]/);
    const prefix = firstAlphaIdx > 0 ? raw.slice(0, firstAlphaIdx) : "";
    const isSubphraseStart = prefix.includes("(") || prefix.includes("[");

    const detail = checkWord({
      raw,
      core,
      isFirst: i === 0,
      isLast: i === words.length - 1,
      lowercaseWords,
      isSubphraseStart,
    });
    if (detail) return { valid: false, detail };
  }
  return { valid: true };
}

module.exports = {
  names: ["heading-title-case"],
  description: "Enforce title case (capital case) for headings, with exceptions for words in backticks and configurable lowercase words.",
  tags: ["headings"],
  function: function (params, onError) {
    const options = params.config?.["heading-title-case"] ?? {};
    const customLower = options.lowercaseWords;
    const lowercaseWords = Array.isArray(customLower) && customLower.length > 0
      ? new Set(customLower.map((w) => String(w).toLowerCase().trim()).filter(Boolean))
      : DEFAULT_LOWERCASE_WORDS;

    const headings = extractHeadings(params.lines);
    for (const h of headings) {
      const { titleText } = parseHeadingNumberPrefix(h.rawText);
      const result = checkTitleCase(titleText, lowercaseWords);
      if (!result.valid) {
        onError({
          lineNumber: h.lineNumber,
          detail: result.detail,
          context: h.rawText,
        });
      }
    }
  },
};
