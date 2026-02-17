"use strict";

const {
  extractHeadings,
  isRuleSuppressedByComment,
  parseHeadingNumberPrefix,
  pathMatchesAny,
  stripInlineCode,
} = require("./utils.js");

/** Token looks like a file name (e.g. README.md, package.json, Makefile); suggest backticks instead of case change. */
const RE_FILE_LIKE = /^[^\s`]*[A-Za-z][^\s`]*\.[A-Za-z0-9]+$/;
const FILENAME_NO_EXT = new Set(["makefile", "dockerfile", "dockerignore", "gitignore", "gitattributes", "npmrc", "editorconfig"]);

function looksLikeFileName(token) {
  if (!token || typeof token !== "string") return false;
  const t = token.trim();
  if (RE_FILE_LIKE.test(t)) return true;
  const lower = t.toLowerCase();
  return FILENAME_NO_EXT.has(lower) || FILENAME_NO_EXT.has(lower.replace(/^\./, ""));
}

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

/** Words that commonly precede a single-letter label (e.g. Phase A, Step B, Appendix A, Type A). */
const LABEL_PARENT_WORDS = new Set([
  "appendix", "category", "chapter", "class", "grade", "item", "letter", "level", "module",
  "option", "part", "phase", "section", "stage", "step", "tier", "type", "unit", "version",
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
 * True if this position is exempt from lowercase (first/last/subphrase start/hyphen compound start/single-letter label).
 * @param {{ isFirst: boolean, isLast: boolean, isSubphraseStart?: boolean, isHyphenCompoundStart?: boolean, isPhaseLabel?: boolean }} opts
 * @returns {boolean}
 */
function isExemptFromLowercase(opts) {
  const { isFirst, isLast, isSubphraseStart, isHyphenCompoundStart, isPhaseLabel } = opts;
  return Boolean(isFirst || isLast || isSubphraseStart || isHyphenCompoundStart || isPhaseLabel);
}

/**
 * Label for error message: "first", "last", or "major" word in title case.
 * @param {{ isFirst: boolean, isLast: boolean, isSubphraseStart?: boolean }} opts
 * @returns {"first"|"last"|"major"}
 */
function getCapitalizationKind(opts) {
  const { isFirst, isLast, isSubphraseStart } = opts;
  if (isFirst || isSubphraseStart) return "first";
  if (isLast) return "last";
  return "major";
}

/**
 * Validate one word for title case; returns error detail string or null if valid.
 * @param {{ raw: string, core: string, isFirst: boolean, isLast: boolean, lowercaseWords: Set<string>, isSubphraseStart?: boolean, isHyphenCompoundStart?: boolean, isPhaseLabel?: boolean }} opts
 * @returns {string|null}
 */
function checkWord(opts) {
  const { raw, core, lowercaseWords } = opts;
  const coreLower = core.toLowerCase();
  const shouldBeLower = !isExemptFromLowercase(opts) && lowercaseWords.has(coreLower);
  if (shouldBeLower) {
    return isAllLower(raw) ? null : `Word "${core}" should be lowercase (middle word in title case).`;
  }
  if (startsWithUpper(raw)) return null;
  return `Word "${core}" should be capitalized (${getCapitalizationKind(opts)} word in title case).`;
}

/**
 * Return the corrected segment text for fixInfo: lowercase or capitalize per AP rules, preserving punctuation.
 * @param {string} rawSeg - Segment as in source (e.g. "And", "(in", "practice)")
 * @param {string} core - stripWordPunctuation(rawSeg)
 * @param {{ isFirst: boolean, isLast: boolean, lowercaseWords: Set<string>, isSubphraseStart?: boolean, isHyphenCompoundStart?: boolean, isPhaseLabel?: boolean }} opts
 * @returns {string}
 */
function getCorrectedSegment(rawSeg, core, opts) {
  const coreLower = core.toLowerCase();
  const shouldBeLower = !isExemptFromLowercase(opts) && opts.lowercaseWords.has(coreLower);
  const correctedCore = shouldBeLower
    ? coreLower
    : core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
  const firstAlpha = rawSeg.search(/[A-Za-z0-9]/);
  if (firstAlpha < 0) return rawSeg;
  const runMatch = rawSeg.slice(firstAlpha).match(/^[A-Za-z0-9]+/);
  const runLen = runMatch ? runMatch[0].length : 0;
  return rawSeg.slice(0, firstAlpha) + correctedCore + rawSeg.slice(firstAlpha + runLen);
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
 * True when the segment is a single letter immediately after a label-parent word (e.g. Phase A, Step B, Appendix A).
 * @param {number} j - Segment index (must be 0 for first segment of word)
 * @param {string} core - stripWordPunctuation(segment)
 * @param {string} previousWordCore - Previous word core, lowercased
 * @returns {boolean}
 */
function isPhaseLabelSegment(j, core, previousWordCore) {
  return j === 0 && core.length === 1 && /^[A-Za-z]$/.test(core) && LABEL_PARENT_WORDS.has(previousWordCore);
}

/**
 * Check one segment of a word for title-case; returns error result or null.
 * @param {{ words: string[], rawSegments: string[], i: number, j: number, wordIsSubphraseStart: boolean, lowercaseWords: Set<string>, previousWordCore?: string }} opts
 * @returns {{ valid: false, detail: string, wordIndex: number, segmentOffset?: number, segmentLength?: number }|null}
 */
function checkOneSegment(opts) {
  const { words, rawSegments, i, j, wordIsSubphraseStart, lowercaseWords, previousWordCore } = opts;
  const rawSeg = rawSegments[j];
  const core = stripWordPunctuation(rawSeg);
  if (!core || !/[a-zA-Z]/.test(core)) return null;

  const isFirst = i === 0 && j === 0;
  const isLast = i === words.length - 1 && j === rawSegments.length - 1;
  const isSubphraseStart = j === 0 && wordIsSubphraseStart;
  const isHyphenCompoundStart = rawSegments.length > 1 && j === 0;
  const isPhaseLabel = isPhaseLabelSegment(j, core, previousWordCore);

  const detail = checkWord({
    raw: rawSeg,
    core,
    isFirst,
    isLast,
    lowercaseWords,
    isSubphraseStart,
    isHyphenCompoundStart,
    isPhaseLabel,
  });
  if (!detail) return null;

  const insertText = getCorrectedSegment(rawSeg, core, {
    isFirst,
    isLast,
    lowercaseWords,
    isSubphraseStart,
    isHyphenCompoundStart,
    isPhaseLabel,
  });
  const seg = getSegmentPosition(rawSegments, j);
  return {
    valid: false,
    detail,
    wordIndex: i,
    insertText,
    ...(seg && { segmentOffset: seg.segmentOffset, segmentLength: seg.segmentLength }),
  };
}

/**
 * Validate title case on a heading's title part (numbering stripped).
 * AP rules: first/last/subphrase-start capitalized; hyphenated segments checked separately;
 * first word after colon treated as subphrase start. Words in backticks are excluded.
 * Returns all violations so each can be reported and highlighted separately.
 *
 * @param {string} titleText - Title after stripping numbering
 * @param {Set<string>} lowercaseWords - Words that must be lowercase in middle
 * @returns {{ valid: boolean, errors: Array<{ detail: string, wordIndex: number, segmentOffset?: number, segmentLength?: number }> }}
 */
function checkTitleCase(titleText, lowercaseWords) {
  const withCodeStripped = stripInlineCode(titleText);
  const words = withCodeStripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { valid: true, errors: [] };

  const errors = [];
  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const firstAlphaIdx = raw.search(/[A-Za-z0-9]/);
    const prefix = firstAlphaIdx > 0 ? raw.slice(0, firstAlphaIdx) : "";
    const afterColon = i > 0 && words[i - 1].replace(/\s+$/, "").endsWith(":");
    const wordIsSubphraseStart = prefix.includes("(") || prefix.includes("[") || afterColon;
    const previousWordCore = i > 0 ? stripWordPunctuation(words[i - 1]).toLowerCase() : "";

    const rawSegments = raw.split(/-/);
    for (let j = 0; j < rawSegments.length; j++) {
      const result = checkOneSegment({
        words,
        rawSegments,
        i,
        j,
        wordIsSubphraseStart,
        lowercaseWords,
        previousWordCore,
      });
      if (result) errors.push({ detail: result.detail, wordIndex: result.wordIndex, insertText: result.insertText, segmentOffset: result.segmentOffset, segmentLength: result.segmentLength });
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build lowercase-words Set from applyTitleCase options.
 * @param {{ lowercaseWords?: string[]|Set<string>, lowercaseWordsReplaceDefault?: boolean }} options
 * @returns {Set<string>}
 */
function getLowercaseWordsFromOptions(options) {
  const customLower = options.lowercaseWords;
  const configSet = Array.isArray(customLower)
    ? new Set([...customLower].map((w) => String(w).toLowerCase().trim()).filter(Boolean))
    : customLower instanceof Set
      ? customLower
      : new Set();
  const replaceDefault = options.lowercaseWordsReplaceDefault === true;
  return replaceDefault
    ? configSet
    : new Set([...DEFAULT_LOWERCASE_WORDS, ...configSet]);
}

/**
 * Correct one segment of a word for AP title case.
 * @param {string} rawSeg - Segment as in source
 * @param {string} core - stripWordPunctuation(rawSeg)
 * @param {{ i: number, j: number, words: string[], rawSegments: string[], wordIsSubphraseStart: boolean, lowercaseWords: Set<string>, previousWordCore?: string }} ctx
 * @returns {string}
 */
function correctSegmentForTitleCase(rawSeg, core, ctx) {
  const { i, j, words, rawSegments, wordIsSubphraseStart, lowercaseWords, previousWordCore } = ctx;
  const isFirst = i === 0 && j === 0;
  const isLast = i === words.length - 1 && j === rawSegments.length - 1;
  const isSubphraseStart = j === 0 && wordIsSubphraseStart;
  const isHyphenCompoundStart = rawSegments.length > 1 && j === 0;
  const isPhaseLabel = isPhaseLabelSegment(j, core, previousWordCore);
  return getCorrectedSegment(rawSeg, core, {
    isFirst,
    isLast,
    lowercaseWords,
    isSubphraseStart,
    isHyphenCompoundStart,
    isPhaseLabel,
  });
}

/**
 * Process one word (possibly hyphenated) for applyTitleCase.
 * @param {string} raw - Raw word
 * @param {number} i - Word index
 * @param {string[]} words - All words
 * @param {Set<string>} lowercaseWords
 * @returns {string}
 */
function processWordForTitleCase(raw, i, words, lowercaseWords) {
  const firstAlphaIdx = raw.search(/[A-Za-z0-9]/);
  const prefix = firstAlphaIdx > 0 ? raw.slice(0, firstAlphaIdx) : "";
  const afterColon = i > 0 && words[i - 1].replace(/\s+$/, "").endsWith(":");
  const wordIsSubphraseStart = prefix.includes("(") || prefix.includes("[") || afterColon;
  const previousWordCore = i > 0 ? stripWordPunctuation(words[i - 1]).toLowerCase() : "";
  const rawSegments = raw.split(/-/);
  const segmentParts = [];
  for (let j = 0; j < rawSegments.length; j++) {
    const rawSeg = rawSegments[j];
    const core = stripWordPunctuation(rawSeg);
    if (!core || !/[a-zA-Z]/.test(core)) {
      segmentParts.push(rawSeg);
      continue;
    }
    segmentParts.push(correctSegmentForTitleCase(rawSeg, core, {
      i,
      j,
      words,
      rawSegments,
      wordIsSubphraseStart,
      lowercaseWords,
      previousWordCore,
    }));
  }
  return segmentParts.join("-");
}

/**
 * Apply AP title case to a title string and return the full corrected title.
 * Uses the same word/segment logic and getCorrectedSegment as the rule.
 *
 * @param {string} titleText - Raw title (e.g. "the quick Brown" or "getting started")
 * @param {{ lowercaseWords?: string[]|Set<string>, lowercaseWordsReplaceDefault?: boolean }} [options] - Optional config; defaults to DEFAULT_LOWERCASE_WORDS when not provided
 * @returns {string} Title with AP capitalization applied
 */
function applyTitleCase(titleText, options = {}) {
  const lowercaseWords = getLowercaseWordsFromOptions(options);
  const withCodeStripped = stripInlineCode(titleText);
  const words = withCodeStripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return titleText;
  const resultParts = words.map((raw, i) =>
    processWordForTitleCase(raw, i, words, lowercaseWords)
  );
  return resultParts.join(" ");
}

/**
 * Get 1-based column and length of the i-th word (or segment within it) in the heading line.
 * Uses the same tokenization as checkTitleCase (stripInlineCode then \S+) so word indices
 * align when the heading contains inline code (backticks) or parentheses.
 *
 * @param {string} line - Full source line (e.g. "## 1.2 The quick Brown")
 * @param {string} rawText - Content after ATX prefix (e.g. "1.2 The quick Brown")
 * @param {string} titleText - Content after numbering (e.g. "The quick Brown")
 * @param {{ wordIndex: number, segmentOffset?: number, segmentLength?: number }} opts
 * @returns {{ column: number, length: number }|null}
 */
function getWordRangeInLine(line, rawText, titleText, opts) {
  const { wordIndex, segmentOffset, segmentLength } = opts;
  const withCodeStripped = stripInlineCode(titleText);
  const wordMatches = [...withCodeStripped.matchAll(/\S+/g)];
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
 * Report a single heading-title-case error (with optional range and fixInfo).
 * @param {object} opts
 * @param {function(object): void} opts.onError
 * @param {number} opts.lineNumber
 * @param {string} opts.line
 * @param {string} opts.detail
 * @param {{ column: number, length: number }|null} opts.rangeInfo
 * @param {string|undefined} opts.insertText
 */
function reportTitleCaseError(opts) {
  const { onError, lineNumber, line, detail, rangeInfo, insertText, lines } = opts;
  if (lines && isRuleSuppressedByComment(lines, lineNumber, "heading-title-case")) return;
  onError({
    lineNumber,
    detail,
    context: line,
    ...(rangeInfo && { range: [rangeInfo.column, rangeInfo.length] }),
    ...(rangeInfo && insertText != null && {
      fixInfo: { editColumn: rangeInfo.column, deleteCount: rangeInfo.length, insertText },
    }),
  });
}

function shouldSkipByPath(filePath, options) {
  const excludePatterns = options.excludePathPatterns;
  return Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns);
}

function getLowercaseWords(options) {
  const customLower = options.lowercaseWords;
  const configSet = Array.isArray(customLower)
    ? new Set(customLower.map((w) => String(w).toLowerCase().trim()).filter(Boolean))
    : new Set();
  const replaceDefault = options.lowercaseWordsReplaceDefault === true;
  return replaceDefault ? configSet : new Set([...DEFAULT_LOWERCASE_WORDS, ...configSet]);
}

/**
 * Return { core, prefix, suffix } so that raw === prefix + core + suffix and core has no leading/trailing punctuation.
 * @param {string} raw - Word token (e.g. "(utils.js," or "allow-custom-anchors.js)")
 * @returns {{ core: string, prefix: string, suffix: string }}
 */
function splitWordPunctuation(raw) {
  const core = stripWordPunctuation(raw);
  const leading = raw.match(/^[^A-Za-z0-9]*/)?.[0] ?? "";
  const trailing = raw.match(/[^A-Za-z0-9]*$/)?.[0] ?? "";
  return { core, prefix: leading, suffix: trailing };
}

function reportFilenameErrors(opts) {
  const { h, line, titleText, onError, lines } = opts;
  const words = stripInlineCode(titleText).split(/\s+/).filter((w) => w.length > 0);
  const fileNameWordIndices = new Set();
  for (let wi = 0; wi < words.length; wi++) {
    const raw = words[wi];
    const { core, prefix, suffix } = splitWordPunctuation(raw);
    if (!core || !looksLikeFileName(core)) continue;
    const rangeInfo = getWordRangeInLine(line, h.rawText, titleText, { wordIndex: wi });
    /* c8 ignore next 1 -- defensive: titleText is always substring of rawText from parseHeadingNumberPrefix */
    if (!rangeInfo) continue;
    fileNameWordIndices.add(wi);
    const insertText = prefix + "`" + core + "`" + suffix;
    reportTitleCaseError({
      onError,
      lineNumber: h.lineNumber,
      line,
      detail: `File name "${core}" should be enclosed in backticks.`,
      rangeInfo,
      insertText,
      lines,
    });
  }
  return fileNameWordIndices;
}

function reportTitleCaseErrors(opts) {
  const { h, line, titleText, result, fileNameWordIndices, onError, lines } = opts;
  for (const err of result.errors) {
    if (fileNameWordIndices.has(err.wordIndex)) continue;
    const rangeInfo = getWordRangeInLine(line, h.rawText, titleText, {
      wordIndex: err.wordIndex,
      segmentOffset: err.segmentOffset,
      segmentLength: err.segmentLength,
    });
    reportTitleCaseError({
      onError,
      lineNumber: h.lineNumber,
      line,
      detail: err.detail,
      rangeInfo,
      insertText: err.insertText,
      lines,
    });
  }
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
  const filePath = params.name || "";
  const options = params.config?.["heading-title-case"] ?? params.config ?? {};
  if (shouldSkipByPath(filePath, options)) return;

  const lowercaseWords = getLowercaseWords(options);
  const headings = extractHeadings(params.lines);

  const lines = params.lines;
  for (const h of headings) {
    const { titleText } = parseHeadingNumberPrefix(h.rawText);
    const line = lines[h.lineNumber - 1];
    const fileNameWordIndices = reportFilenameErrors({ h, line, titleText, onError, lines });
    const result = checkTitleCase(titleText, lowercaseWords);
    if (!result.valid) {
      reportTitleCaseErrors({ h, line, titleText, result, fileNameWordIndices, onError, lines });
    }
  }
}

module.exports = {
  names: ["heading-title-case"],
  description: "Enforce AP-style capitalization for headings, with exceptions for words in backticks and configurable lowercase words.",
  tags: ["headings"],
  function: ruleFunction,
  applyTitleCase,
};
