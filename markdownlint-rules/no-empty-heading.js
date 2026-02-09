"use strict";

const { extractHeadings, pathMatchesAny } = require("./utils.js");

/** Match HTML comment line (single line). */
const RE_HTML_COMMENT = /^\s*<!--.*-->\s*$/;

/** Match the exact suppress comment: <!-- no-empty-heading allow --> (optional whitespace). */
const RE_SUPPRESS_COMMENT_RAW = /^\s*<!--\s*no-empty-heading\s+allow\s*-->\s*$/;

/** Match markdownlint-cleared form: comment text is replaced with dots (e.g. "................ ....."). */
const RE_SUPPRESS_COMMENT_CLEARED = /^\s*<!--\s*\.{16}\s+\.{5}\s*-->\s*$/;

/**
 * Return true if the trimmed line counts as content (non-blank, not only HTML comment).
 *
 * @param {string} trimmed - Trimmed line
 * @returns {boolean}
 */
function isContentLine(trimmed) {
  if (trimmed === "") {
    return false;
  }
  if (RE_HTML_COMMENT.test(trimmed)) {
    return false;
  }
  return true;
}

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
 * Return whether the heading has direct content or a suppress comment. Only lines
 * before the next heading (any level) count; subheadings and content under them do not.
 *
 * @param {string[]} lines - All lines
 * @param {{ lineNumber: number }} heading - Heading info
 * @param {number} endLine - Last line index (1-based) of section
 * @param {Array<{ lineNumber: number }>} headings - All headings (to detect next heading line)
 * @returns {boolean}
 */
function sectionHasDirectContentOrSuppress(lines, heading, endLine, headings) {
  const headingLineNumbers = new Set(headings.map((h) => h.lineNumber));
  const lastLine = Math.min(endLine, lines.length);
  for (let lineNumber = heading.lineNumber + 1; lineNumber <= lastLine; lineNumber++) {
    if (headingLineNumbers.has(lineNumber)) {
      return false;
    }
    const trimmed = lines[lineNumber - 1].trim();
    if (isContentLine(trimmed)) {
      return true;
    }
    if (isSuppressComment(trimmed)) {
      return true;
    }
  }
  return false;
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
  const config = params.config || {};
  const excludePatterns = config.excludePathPatterns;
  if (Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns)) {
    return;
  }

  const headings = extractHeadings(lines);
  const h2Plus = headings.filter((h) => h.level >= 2);

  for (const heading of h2Plus) {
    const nextSameOrHigher = headings.find(
      (h) => h.lineNumber > heading.lineNumber && h.level <= heading.level
    );
    const endLine = nextSameOrHigher ? nextSameOrHigher.lineNumber - 1 : lines.length;
    if (sectionHasDirectContentOrSuppress(lines, heading, endLine, headings)) {
      continue;
    }
    onError({
      lineNumber: heading.lineNumber,
      detail: "H2+ heading must have at least one line of content directly under it before any subheading (blank and HTML-comment-only lines do not count).",
      context: lines[heading.lineNumber - 1],
    });
  }
}

module.exports = {
  names: ["no-empty-heading"],
  description: "H2+ headings must have at least one line of content directly under them (before any subheading); content under subheadings does not count.",
  tags: ["headings"],
  function: ruleFunction,
};
