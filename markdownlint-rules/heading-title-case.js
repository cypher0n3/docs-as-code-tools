"use strict";

const {
  extractHeadings,
  parseHeadingNumberPrefix,
  stripInlineCode,
} = require("./utils.js");

/** Default lowercase words for AP-style headings (unless first/last/subphrase-start). */
const DEFAULT_LOWERCASE_WORDS = new Set([
  // Articles
  "a", "an", "the",

  // Coordinating conjunctions
  "and", "but", "for", "nor", "or", "so", "yet",

  // Prepositions (3 letters or fewer) and infinitive "to"
  "as", "at", "by", "in", "of", "off", "on", "out", "per", "to", "up", "via",

  // Short verb/pronoun (AP: lowercase when not first/last)
  "is", "its",

  // Comparison/citations
  "v", "vs",
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
    return isAllLower(raw) ? null : `Word "${core}" should be lowercase (middle word in title case).`;
  }
  if (startsWithUpper(raw)) return null;
  const kind = (isFirst || isSubphraseStart) ? "first" : isLast ? "last" : "major";
  return `Word "${core}" should be capitalized (${kind} word in title case).`;
}

/**
 * Compute 0-based offset and length of segment j within a hyphenated word.
 * @param {string[]} rawSegments - Parts of the word split on '-'
 * @param {number} j - Segment index
 * @returns {{ segmentOffset: number, segmentLength: number }|undefined}
 */
function getSegmentPosition(rawSegments, j) {
  if (rawSegments.length <= 1) return undefined;
  let segmentOffset = 0;
  for (let k = 0; k < j; k++) segmentOffset += rawSegments[k].length + 1;
  return { segmentOffset, segmentLength: rawSegments[j].length };
}

/**
 * Check one segment of a word for title-case; returns error result or null.
 * @param {{ words: string[], rawSegments: string[], i: number, j: number, wordIsSubphraseStart: boolean, lowercaseWords: Set<string> }} opts
 * @returns {{ valid: false, detail: string, wordIndex: number, segmentOffset?: number, segmentLength?: number }|null}
 */
function checkOneSegment(opts) {
  const { words, rawSegments, i, j, wordIsSubphraseStart, lowercaseWords } = opts;
  const rawSeg = rawSegments[j];
  const core = stripWordPunctuation(rawSeg);
  if (!core || !/[a-zA-Z]/.test(core)) return null;

  const isFirst = i === 0 && j === 0;
  const isLast = i === words.length - 1 && j === rawSegments.length - 1;
  const isSubphraseStart = j === 0 && wordIsSubphraseStart;

  const detail = checkWord({
    raw: rawSeg,
    core,
    isFirst,
    isLast,
    lowercaseWords,
    isSubphraseStart,
  });
  if (!detail) return null;

  const seg = getSegmentPosition(rawSegments, j);
  return {
    valid: false,
    detail,
    wordIndex: i,
    ...(seg && { segmentOffset: seg.segmentOffset, segmentLength: seg.segmentLength }),
  };
}

/**
 * Validate title case on a heading's title part (numbering stripped).
 * AP rules: first/last/subphrase-start capitalized; hyphenated segments checked separately;
 * first word after colon treated as subphrase start. Words in backticks are excluded.
 *
 * @param {string} titleText - Title after stripping numbering
 * @param {Set<string>} lowercaseWords - Words that must be lowercase in middle
 * @returns {{ valid: boolean, detail?: string, wordIndex?: number, segmentOffset?: number, segmentLength?: number }}
 */
function checkTitleCase(titleText, lowercaseWords) {
  const withCodeStripped = stripInlineCode(titleText);
  const words = withCodeStripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { valid: true };

  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const firstAlphaIdx = raw.search(/[A-Za-z0-9]/);
    const prefix = firstAlphaIdx > 0 ? raw.slice(0, firstAlphaIdx) : "";
    const afterColon = i > 0 && words[i - 1].replace(/\s+$/, "").endsWith(":");
    const wordIsSubphraseStart = prefix.includes("(") || prefix.includes("[") || afterColon;

    const rawSegments = raw.split(/-/);
    for (let j = 0; j < rawSegments.length; j++) {
      const result = checkOneSegment({
        words,
        rawSegments,
        i,
        j,
        wordIsSubphraseStart,
        lowercaseWords,
      });
      if (result) return result;
    }
  }
  return { valid: true };
}

/**
 * Get 1-based column and length of the i-th word (or segment within it) in the heading line.
 * @param {string} line - Full source line (e.g. "## 1.2 The quick Brown")
 * @param {string} rawText - Content after ATX prefix (e.g. "1.2 The quick Brown")
 * @param {string} titleText - Content after numbering (e.g. "The quick Brown")
 * @param {{ wordIndex: number, segmentOffset?: number, segmentLength?: number }} opts
 * @returns {{ column: number, length: number }|null}
 */
function getWordRangeInLine(line, rawText, titleText, opts) {
  const { wordIndex, segmentOffset, segmentLength } = opts;
  const wordMatches = [...titleText.matchAll(/\S+/g)];
  if (wordIndex < 0 || wordIndex >= wordMatches.length) return null;
  const rawTextStart = line.indexOf(rawText);
  if (rawTextStart === -1) return null;
  const titleStartInRaw = rawText.indexOf(titleText);
  if (titleStartInRaw === -1) return null;
  const m = wordMatches[wordIndex];
  let column = rawTextStart + titleStartInRaw + m.index + 1;
  let length = m[0].length;
  if (segmentOffset !== undefined && segmentLength !== undefined) {
    column += segmentOffset;
    length = segmentLength;
  }
  return { column, length };
}

/**
 * markdownlint rule: enforce AP-style heading capitalization.
 * - First and last words must be capitalized.
 * - Lowercase only a small set of minor words (articles, coordinating conjunctions,
 *   and short prepositions) in the middle.
 * - Words in backticks are skipped.
 *
 * @param {object} params - markdownlint params (lines, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const options = params.config?.["heading-title-case"] ?? {};
  const customLower = options.lowercaseWords;
  const configSet = Array.isArray(customLower)
    ? new Set(customLower.map((w) => String(w).toLowerCase().trim()).filter(Boolean))
    : new Set();
  const replaceDefault = options.lowercaseWordsReplaceDefault === true;
  const lowercaseWords = replaceDefault
    ? configSet
    : new Set([...DEFAULT_LOWERCASE_WORDS, ...configSet]);

    const headings = extractHeadings(params.lines);
    for (const h of headings) {
      const { titleText } = parseHeadingNumberPrefix(h.rawText);
      const result = checkTitleCase(titleText, lowercaseWords);
      if (!result.valid) {
        const line = params.lines[h.lineNumber - 1];
        const rangeInfo = getWordRangeInLine(line, h.rawText, titleText, {
          wordIndex: result.wordIndex,
          segmentOffset: result.segmentOffset,
          segmentLength: result.segmentLength,
        });
        onError({
          lineNumber: h.lineNumber,
          detail: result.detail,
          context: line,
          ...(rangeInfo && { range: [rangeInfo.column, rangeInfo.length] }),
        });
      }
    }
  }

module.exports = {
  names: ["heading-title-case"],
  description: "Enforce AP-style capitalization for headings, with exceptions for words in backticks and configurable lowercase words.",
  tags: ["headings"],
  function: ruleFunction,
};
