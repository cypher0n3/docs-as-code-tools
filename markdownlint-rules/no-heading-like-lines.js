"use strict";

const path = require("path");
const { extractHeadings, isRuleSuppressedByComment, pathMatchesAny } = require("./utils.js");

/** True if heading-title-case.js was successfully required (present in same rules dir). */
let hasHeadingTitleCase = false;
/** True if heading-numbering.js was successfully required (present in same rules dir). */
let hasHeadingNumbering = false;
/** applyTitleCase from heading-title-case (only valid when hasHeadingTitleCase). */
let applyTitleCaseFn = null;
/** getExpectedPrefixForNewHeading from heading-numbering (only valid when hasHeadingNumbering). */
let getExpectedPrefixForNewHeadingFn = null;

/* c8 ignore start -- optional deps: load at most once; catch branches hard to cover in same process */
try {
  const titleCaseMod = require(path.join(__dirname, "heading-title-case.js"));
  applyTitleCaseFn = titleCaseMod.applyTitleCase;
  hasHeadingTitleCase = true;
} catch {
  // Optional: user may not copy heading-title-case.js
}
try {
  const numberingMod = require(path.join(__dirname, "heading-numbering.js"));
  getExpectedPrefixForNewHeadingFn = numberingMod.getExpectedPrefixForNewHeading;
  hasHeadingNumbering = true;
} catch {
  // Optional: user may not copy heading-numbering.js
}
/* c8 ignore stop */

/** Patterns: [regex, description]. Order matches EXTRACTORS. Includes MD036-style whole-line emphasis. Require content (.+ not .*) so **:** does not match. */
const PATTERNS = [
  [/^\s*\*\*.+:\*\*\s*$/, "bold with colon inside (**Text:**)"],
  [/^\s*\*\*.+\*\*:\s*$/, "bold with colon outside (**Text**:)"],
  [/^\s*[0-9]+\.\s+\*\*.*\*\*\s*$/, "numbered list with bold (1. **Text**)"],
  [/^\s*\*.*:\*\s*$/, "italic with colon inside (*Text:*)"],
  [/^\s*\*.*\*:\s*$/, "italic with colon outside (*Text*:)"],
  [/^\s*[0-9]+\.\s+\*.*\*\s*$/, "numbered list with italic (1. *Text*)"],
  [/^\s*\*\*(.+)\*\*\s*$/, "bold only (whole line, **Text**)"],
  [/^\s*\*([^*]+)\*\s*$/, "italic only (whole line, *Text*)"],
];

/** For each pattern index: [regex, formatter(match) -> title]. */
const EXTRACTORS = [
  [/^\s*\*\*(.+):\*\*\s*$/, (m) => m[1] + ":"],
  [/^\s*\*\*(.+)\*\*:\s*$/, (m) => m[1] + ":"],
  [/^\s*[0-9]+\.\s+\*\*(.+)\*\*\s*$/, (m) => m[1].trim()],
  [/^\s*\*(.+):\*\s*$/, (m) => m[1] + ":"],
  [/^\s*\*(.+)\*:\s*$/, (m) => m[1] + ":"],
  [/^\s*[0-9]+\.\s+\*(.+)\*\s*$/, (m) => m[1].trim()],
  [/^\s*\*\*(.+)\*\*\s*$/, (m) => m[1].trim()],
  [/^\s*\*([^*]+)\*\s*$/, (m) => m[1].trim()],
];

/** Pattern indices that are MD036-style (whole-line emphasis); skip when content ends with punctuation. */
const MD036_STYLE_PATTERN_INDICES = new Set([6, 7]);

/**
 * Extract plain title from a heading-like line given the pattern index that matched.
 * @param {string} trimmedLine - Trimmed line content
 * @param {number} patternIndex - Index into PATTERNS (0-7)
 * @returns {string} Extracted title (e.g. "Summary:" or "Introduction")
 */
function extractTitleFromHeadingLike(trimmedLine, patternIndex) {
  const entry = EXTRACTORS[patternIndex];
  /* c8 ignore next 1 -- patternIndex always 0-7 from PATTERNS loop */
  if (!entry) return trimmedLine;
  const [regex, format] = entry;
  const m = trimmedLine.match(regex);
  return m ? format(m) : trimmedLine;
}

/**
 * Get context-aware heading level for a violation at lineNumber when convertToHeading is true.
 * @param {{ lineNumber: number, level: number, rawText: string }[]} headings - From extractHeadings(lines)
 * @param {number} violationLineNumber - 1-based line of the heading-like line
 * @param {{ defaultHeadingLevel?: number, fixedHeadingLevel?: number }} config
 * @returns {number} 1-6
 */
function getContextLevel(headings, violationLineNumber, config) {
  const fixedLevel = config.fixedHeadingLevel;
  if (typeof fixedLevel === "number" && fixedLevel >= 1 && fixedLevel <= 6) {
    return fixedLevel;
  }
  const defaultLevel = typeof config.defaultHeadingLevel === "number" && config.defaultHeadingLevel >= 1 && config.defaultHeadingLevel <= 6
    ? config.defaultHeadingLevel
    : 2;
  const before = headings.filter((h) => h.lineNumber < violationLineNumber);
  if (before.length === 0) return defaultLevel;
  const last = before[before.length - 1];
  return Math.min(6, last.level + 1);
}

/**
 * Build insertText when convertToHeading is true (ATX heading line, optional blank after).
 * @param {object} opts
 * @param {string[]} opts.lines - Document lines
 * @param {number} opts.index - Index of current line
 * @param {number} opts.lineNumber - 1-based line number
 * @param {{ lineNumber: number, level: number, rawText: string }[]} opts.headings
 * @param {{ defaultHeadingLevel?: number, fixedHeadingLevel?: number }} opts.config
 * @param {object} opts.ruleConfig - Full rule config
 * @param {string} opts.extractedTitle - Extracted title from heading-like line
 * @returns {string}
 */
function buildConvertToHeadingInsertText(opts) {
  const { lines, index, lineNumber, headings, config, ruleConfig, extractedTitle } = opts;
  const level = getContextLevel(headings, lineNumber, config);
  let numberPrefix = "";
  /* c8 ignore next 3 -- branch when heading-numbering absent covered by subprocess test */
  if (hasHeadingNumbering && getExpectedPrefixForNewHeadingFn) {
    numberPrefix = getExpectedPrefixForNewHeadingFn(lines, lineNumber, level);
  }
  /* c8 ignore next 3 -- branch when heading-title-case absent covered by subprocess test */
  const titleText = hasHeadingTitleCase && applyTitleCaseFn
    ? applyTitleCaseFn(extractedTitle, ruleConfig)
    : extractedTitle;
  let headingLine = "#".repeat(level) + " " + numberPrefix + titleText;
  const nextLine = lines[index + 1];
  const nextNonBlank = nextLine != null && nextLine.trim().length > 0;
  if (nextNonBlank) headingLine += "\n";
  return headingLine;
}

/** True when pattern p matched but content is only colon (e.g. **:**); skip reporting. */
function skipBoldColonOnly(trimmedLine, p, pattern) {
  if (![0, 1, 6].includes(p)) return false;
  const reWithGroup = p <= 1 ? EXTRACTORS[p][0] : pattern;
  const m = trimmedLine.match(reWithGroup);
  const content = m?.[1];
  return content != null && (content.trim() === "" || content.trim() === ":");
}

/**
 * Find first pattern index that matches and passes skip checks; returns { p, description, extractedTitle } or null.
 */
function findHeadingLikeMatch(trimmedLine, punctuationMarks) {
  for (let p = 0; p < PATTERNS.length; p++) {
    const [pattern, description] = PATTERNS[p];
    if (!pattern.test(trimmedLine) || skipBoldColonOnly(trimmedLine, p, pattern)) continue;
    const extractedTitle = extractTitleFromHeadingLike(trimmedLine, p);
    if (MD036_STYLE_PATTERN_INDICES.has(p) && extractedTitle.length > 0) {
      const lastChar = extractedTitle.slice(-1);
      if (punctuationMarks.includes(lastChar)) continue;
    }
    return { p, description, extractedTitle };
  }
  return null;
}

/** Build and report one heading-like error. */
function reportHeadingLikeError(line, index, match, ctx) {
  const { lines, headings, config, ruleConfig, convertToHeading, onError } = ctx;
  const { description, extractedTitle } = match;
  const lineNumber = index + 1;
  const insertText = !convertToHeading
    ? extractedTitle
    : buildConvertToHeadingInsertText({
      lines, index, lineNumber, headings, config, ruleConfig, extractedTitle,
    });
  if (isRuleSuppressedByComment(lines, lineNumber, "no-heading-like-lines")) return;
  onError({
    lineNumber,
    detail: `Line looks like ${description}; use an ATX heading (# Title) instead of heading-like formatting.`,
    context: line,
    fixInfo: { editColumn: 1, deleteCount: line.length, insertText },
  });
}

/** Normalize rule config and build context for processing. */
function getNoHeadingLikeContext(params, onError) {
  const lines = params.lines;
  const ruleConfig = params.config?.["no-heading-like-lines"] ?? params.config ?? {};
  const convertToHeading = ruleConfig.convertToHeading === true;
  const defaultHeadingLevel = ruleConfig.defaultHeadingLevel;
  const fixedHeadingLevel = ruleConfig.fixedHeadingLevel;
  const punctuationMarks = typeof ruleConfig.punctuationMarks === "string"
    ? ruleConfig.punctuationMarks
    : ".,;!?";
  const config = { defaultHeadingLevel, fixedHeadingLevel };
  const headings = convertToHeading ? extractHeadings(lines) : [];
  return {
    lines,
    ruleConfig,
    excludePathPatterns: ruleConfig.excludePathPatterns,
    punctuationMarks,
    config,
    headings,
    convertToHeading,
    onError,
    ctx: { lines, headings, config, ruleConfig, convertToHeading, onError },
  };
}

/**
 * markdownlint rule: flag lines that look like headings but use bold/italic
 * (e.g. **Section:** or 1. **Item**, or MD036-style **Introduction** / *Note*)
 * so they can be converted to proper ATX headings. Supports fixInfo for --fix.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const { lines, excludePathPatterns, punctuationMarks, ctx } = getNoHeadingLikeContext(params, onError);
  const filePath = params.name || "";
  if (Array.isArray(excludePathPatterns) && excludePathPatterns.length > 0 && pathMatchesAny(filePath, excludePathPatterns)) {
    return;
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const match = findHeadingLikeMatch(trimmedLine, punctuationMarks);
    if (!match) continue;
    reportHeadingLikeError(line, index, match, ctx);
  }
}

module.exports = {
  names: ["no-heading-like-lines"],
  description: "Disallow heading-like lines that should be proper headings",
  tags: ["headings"],
  function: ruleFunction,
};
