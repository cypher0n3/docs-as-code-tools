"use strict";

const { extractHeadings, isRuleSuppressedByComment, pathMatchesAny } = require("./utils.js");

/** Match HTML comment line (single line). */
const RE_HTML_COMMENT = /^\s*<!--.*-->\s*$/;


/** Match the exact suppress comment: <!-- no-empty-heading allow --> (optional whitespace). */
const RE_SUPPRESS_COMMENT_RAW = /^\s*<!--\s*no-empty-heading\s+allow\s*-->\s*$/;

/** Match markdownlint-cleared form: comment text is replaced with dots (e.g. "................ ....."). */
const RE_SUPPRESS_COMMENT_CLEARED = /^\s*<!--\s*\.{16}\s+\.{5}\s*-->\s*$/;

/** Match line that looks like an HTML tag (opening, closing, or self-closing). */
const RE_HTML_TAG_LINE = /^\s*<[a-zA-Z/!][^>]*>\s*$/;

/** Default config: require 1 line; only prose counts (no blank, no HTML comments). */
const DEFAULT_CONFIG = {
  minimumContentLines: 1,
  countBlankLinesAsContent: false,
  countHTMLCommentsAsContent: false,
  countCodeBlockLinesAsContent: true,
  countHtmlLinesAsContent: false,
};

/**
 * Return true if the trimmed line is the rule's suppress comment (allows empty section).
 * Only a line that is solely this comment (plus optional whitespace) suppresses; other
 * HTML comments in the section are allowed but do not count as content or as suppress.
 * Accepts raw "<!-- no-empty-heading allow -->" or markdownlint-cleared form.
 *
 * @param {string} trimmed - Trimmed line
 * @returns {boolean}
 */
function isSuppressComment(trimmed) {
  return RE_SUPPRESS_COMMENT_RAW.test(trimmed) || RE_SUPPRESS_COMMENT_CLEARED.test(trimmed);
}

/**
 * Return true if the trimmed line looks like an HTML tag (not a comment).
 * @param {string} trimmed - Trimmed line
 * @returns {boolean}
 */
function isHtmlTagLine(trimmed) {
  return RE_HTML_TAG_LINE.test(trimmed);
}

/**
 * Return true if the trimmed line is inside or part of a multi-line HTML comment (<!-- ... -->).
 * Used to treat such lines like single-line HTML comments for content counting.
 *
 * @param {string} trimmed - Trimmed line
 * @param {{ inMultilineComment: boolean }} state - Current multi-line comment state
 * @returns {{ isCommentLine: boolean, inMultilineComment: boolean }} - Whether this line counts as comment; new state for next line
 */
function updateMultilineCommentState(trimmed, state) {
  const wasIn = state.inMultilineComment;
  if (wasIn) {
    const closes = /-->\s*$/.test(trimmed);
    return { isCommentLine: true, inMultilineComment: !closes };
  }
  if (RE_HTML_COMMENT.test(trimmed)) {
    return { isCommentLine: true, inMultilineComment: false };
  }
  const opens = /^\s*<!--/.test(trimmed) && !/-->\s*$/.test(trimmed);
  return { isCommentLine: opens, inMultilineComment: opens };
}

/**
 * Return true if the trimmed line counts as content under the given config.
 * Prose (non-blank, not only HTML comment/tag) always counts; blank, HTML-comment,
 * and HTML-tag lines count only when the corresponding config option is true.
 * Single-line and multi-line HTML comments are treated alike.
 * The suppress comment never counts as content (it only suppresses the rule for that section).
 *
 * @param {string} trimmed - Trimmed line
 * @param {{ countBlankLinesAsContent: boolean, countHTMLCommentsAsContent: boolean, countHtmlLinesAsContent: boolean }} opts
 * @param {{ isCommentLine: boolean }} multilineContext - Optional; when isCommentLine is true, line is treated as HTML comment
 * @returns {boolean}
 */
function isContentLine(trimmed, opts, multilineContext) {
  if (trimmed === "") {
    return opts.countBlankLinesAsContent;
  }
  if (isSuppressComment(trimmed)) {
    return false;
  }
  if (multilineContext && multilineContext.isCommentLine) {
    return opts.countHTMLCommentsAsContent;
  }
  if (RE_HTML_COMMENT.test(trimmed)) {
    return opts.countHTMLCommentsAsContent;
  }
  if (isHtmlTagLine(trimmed)) {
    return opts.countHtmlLinesAsContent;
  }
  return true;
}

/**
 * Return whether the section has the suppress comment (on its own line).
 *
 * @param {string[]} lines - All lines
 * @param {{ lineNumber: number }} heading - Heading info
 * @param {number} endLine - Last line index (1-based) of section
 * @param {Set<number>} headingLineNumbers - Set of line numbers that are headings
 * @returns {boolean}
 */
function sectionHasSuppressComment(lines, heading, endLine, headingLineNumbers) {
  const lastLine = Math.min(endLine, lines.length);
  for (let lineNumber = heading.lineNumber + 1; lineNumber <= lastLine; lineNumber++) {
    if (headingLineNumbers.has(lineNumber)) return false;
    if (isSuppressComment(lines[lineNumber - 1].trim())) return true;
  }
  return false;
}

/**
 * Update fence state from a line (``` or ~~~). Returns new state and whether the line is a fence delimiter.
 * @param {string} trimmed - Trimmed line
 * @param {{ inFence: boolean, fenceMarker: string|null }} state
 * @returns {{ inFence: boolean, fenceMarker: string|null, isFenceLine: boolean }}
 */
function updateFenceState(trimmed, state) {
  const fenceMatch = trimmed.match(/^(```+|~~~+)/);
  if (!fenceMatch) {
    return { ...state, isFenceLine: false };
  }
  const marker = fenceMatch[1][0] === "`" ? "```" : "~~~";
  if (!state.inFence) {
    return { inFence: true, fenceMarker: marker, isFenceLine: true };
  }
  if (state.fenceMarker === marker) {
    return { inFence: false, fenceMarker: null, isFenceLine: true };
  }
  return { ...state, isFenceLine: true };
}

/**
 * Count lines in the section that count as content under the given opts.
 * Only lines before the next heading (any level) are considered.
 * When countCodeBlockLinesAsContent is false, lines inside fenced code blocks (``` or ~~~) are not counted.
 *
 * @param {{ lines: string[], heading: { lineNumber: number }, endLine: number, headingLineNumbers: Set<number>, contentOpts: { countBlankLinesAsContent: boolean, countHTMLCommentsAsContent: boolean, countHtmlLinesAsContent: boolean, countCodeBlockLinesAsContent: boolean } }} ctx
 * @returns {number}
 */
function sectionContentLineCount(ctx) {
  const { lines, heading, endLine, headingLineNumbers, contentOpts } = ctx;
  let count = 0;
  let fenceState = { inFence: false, fenceMarker: null };
  let multilineCommentState = { inMultilineComment: false };
  const lastLine = Math.min(endLine, lines.length);
  for (let lineNumber = heading.lineNumber + 1; lineNumber <= lastLine; lineNumber++) {
    if (headingLineNumbers.has(lineNumber)) break;
    const trimmed = lines[lineNumber - 1].trim();
    const { isCommentLine, inMultilineComment } = updateMultilineCommentState(
      trimmed,
      multilineCommentState
    );
    multilineCommentState = { inMultilineComment };
    const nextFence = updateFenceState(trimmed, fenceState);
    fenceState = nextFence;
    if (!contentOpts.countCodeBlockLinesAsContent && (nextFence.isFenceLine || nextFence.inFence)) {
      continue;
    }
    if (isContentLine(trimmed, contentOpts, { isCommentLine })) count += 1;
  }
  return count;
}

/**
 * Normalize rule config to validated values.
 * @param {object} config - Raw config
 * @returns {{ minimumContentLines: number, contentOpts: { countBlankLinesAsContent: boolean, countHTMLCommentsAsContent: boolean, countHtmlLinesAsContent: boolean, countCodeBlockLinesAsContent: boolean } }}
 */
function normalizeConfig(config) {
  const minimumContentLines = typeof config.minimumContentLines === "number" && config.minimumContentLines >= 1
    ? config.minimumContentLines
    : DEFAULT_CONFIG.minimumContentLines;
  const countBlankLinesAsContent = typeof config.countBlankLinesAsContent === "boolean"
    ? config.countBlankLinesAsContent
    : DEFAULT_CONFIG.countBlankLinesAsContent;
  const countHTMLCommentsAsContent = typeof config.countHTMLCommentsAsContent === "boolean"
    ? config.countHTMLCommentsAsContent
    : DEFAULT_CONFIG.countHTMLCommentsAsContent;
  const countHtmlLinesAsContent = typeof config.countHtmlLinesAsContent === "boolean"
    ? config.countHtmlLinesAsContent
    : DEFAULT_CONFIG.countHtmlLinesAsContent;
  const countCodeBlockLinesAsContent = typeof config.countCodeBlockLinesAsContent === "boolean"
    ? config.countCodeBlockLinesAsContent
    : DEFAULT_CONFIG.countCodeBlockLinesAsContent;
  return {
    minimumContentLines,
    contentOpts: {
      countBlankLinesAsContent,
      countHTMLCommentsAsContent,
      countHtmlLinesAsContent,
      countCodeBlockLinesAsContent,
    },
  };
}

/**
 * Build the "what counts" clause for the error detail.
 * @param {{ countBlankLinesAsContent: boolean, countHTMLCommentsAsContent: boolean, countHtmlLinesAsContent: boolean, countCodeBlockLinesAsContent: boolean }} contentOpts
 * @returns {string}
 */
function buildWhatCountsClause(contentOpts) {
  const {
    countBlankLinesAsContent,
    countHTMLCommentsAsContent,
    countHtmlLinesAsContent,
    countCodeBlockLinesAsContent,
  } = contentOpts;
  const countExtras = [
    countBlankLinesAsContent && "blank lines",
    countHTMLCommentsAsContent && "HTML-comment-only lines",
    countHtmlLinesAsContent && "HTML tag lines",
    countCodeBlockLinesAsContent && "code block lines",
  ].filter(Boolean);
  if (countExtras.length > 0) {
    return countExtras.join(" and ") + " count as content";
  }
  const doNotCount = [
    !countBlankLinesAsContent && "blank lines",
    !countHTMLCommentsAsContent && "HTML-comment-only lines",
    !countHtmlLinesAsContent && "HTML tag lines",
    !countCodeBlockLinesAsContent && "code block lines",
  ].filter(Boolean);
  return doNotCount.join(", ") + " do not count";
}

/**
 * Build error detail message for empty-heading violation.
 * @param {number} minimumContentLines
 * @param {{ countBlankLinesAsContent: boolean, countHTMLCommentsAsContent: boolean, countHtmlLinesAsContent: boolean, countCodeBlockLinesAsContent: boolean }} contentOpts
 * @returns {string}
 */
function buildDetailMessage(minimumContentLines, contentOpts) {
  const minDesc = minimumContentLines === 1 ? "at least one line of content" : `at least ${minimumContentLines} lines of content`;
  const whatCounts = buildWhatCountsClause(contentOpts);
  return `H2+ heading must have ${minDesc} directly under it before any subheading (${whatCounts}).`;
}

/**
 * Return true if this H2+ heading has too little content (violation).
 *
 * @param {object} ctx - { heading, headings, lines, headingLineNumbers, minimumContentLines, contentOpts }
 * @returns {boolean}
 */
function headingHasTooLittleContent(ctx) {
  const { heading, headings, lines, headingLineNumbers, minimumContentLines, contentOpts } = ctx;
  const nextSameOrHigher = headings.find(
    (h) => h.lineNumber > heading.lineNumber && h.level <= heading.level
  );
  const endLine = nextSameOrHigher ? nextSameOrHigher.lineNumber - 1 : lines.length;
  if (sectionHasSuppressComment(lines, heading, endLine, headingLineNumbers)) {
    return false;
  }
  const count = sectionContentLineCount({ lines, heading, endLine, headingLineNumbers, contentOpts });
  return count < minimumContentLines;
}

function reportEmptyHeading(heading, ctx) {
  const { headings, lines, headingLineNumbers, minimumContentLines, contentOpts, onError } = ctx;
  if (!headingHasTooLittleContent({
    heading, headings, lines, headingLineNumbers, minimumContentLines, contentOpts,
  })) {
    return;
  }
  if (isRuleSuppressedByComment(lines, heading.lineNumber, "no-empty-heading")) return;
  onError({
    lineNumber: heading.lineNumber,
    detail: buildDetailMessage(minimumContentLines, contentOpts),
    context: lines[heading.lineNumber - 1],
  });
}

/**
 * markdownlint rule: every H2+ heading must have at least one line of content
 * directly under it (before any subheading). Content under subheadings does not
 * count. Blank lines and HTML-comment-only lines do not count as content. The
 * exact comment "<!-- no-empty-heading allow -->" on its own line suppresses the error.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const filePath = params.name || "";
  const block = params.config?.["no-empty-heading"] ?? params.config ?? {};
  const excludePatterns = block.excludePathPatterns;
  if (Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns)) {
    return;
  }

  const { minimumContentLines, contentOpts } = normalizeConfig(block);
  const headings = extractHeadings(lines);
  const h2Plus = headings.filter((h) => h.level >= 2);
  const headingLineNumbers = new Set(headings.map((h) => h.lineNumber));
  const ctx = { headings, lines, headingLineNumbers, minimumContentLines, contentOpts, onError };

  for (const heading of h2Plus) {
    reportEmptyHeading(heading, ctx);
  }
}

module.exports = {
  names: ["no-empty-heading"],
  description: "H2+ headings must have at least one line of content directly under them (before any subheading); content under subheadings does not count.",
  tags: ["headings"],
  function: ruleFunction,
};
