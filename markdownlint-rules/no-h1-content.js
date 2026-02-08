"use strict";

const { extractHeadings, pathMatchesAny } = require("./utils.js");

/** Match HTML comment line (single line). */
const RE_HTML_COMMENT = /^\s*<!--.*-->\s*$/;

/** Match list item that is a single anchor link: - [text](#id) or 1. [text](#id). */
const RE_TOC_LIST_ITEM = /^\s*([-*]|\d+\.)\s+\[.+\]\(#\S+\)\s*$/;

/** Match badge line(s): [![alt](img-url)](link-url), optionally repeated with spaces. */
const RE_BADGE_LINE = /^\s*(\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*)+\s*$/;

/**
 * Return true if the trimmed line is allowed under h1 (blank, TOC, badge, or HTML comment).
 *
 * @param {string} trimmed - Trimmed line
 * @returns {boolean}
 */
function isAllowedUnderH1(trimmed) {
  if (trimmed === "") {
    return true;
  }
  if (RE_HTML_COMMENT.test(trimmed)) {
    return true;
  }
  if (RE_TOC_LIST_ITEM.test(trimmed)) {
    return true;
  }
  if (RE_BADGE_LINE.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * markdownlint rule: under the first h1 heading, only table-of-contents content
 * is allowed (blank lines, list items that are anchor links, badges, HTML comments).
 * Any other content (prose, code blocks, etc.) is reported.
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
  const firstH1 = headings.find((h) => h.level === 1);
  if (!firstH1) {
    return;
  }

  const nextHeading = headings.find((h) => h.lineNumber > firstH1.lineNumber);
  const endLine = nextHeading ? nextHeading.lineNumber - 1 : lines.length;

  for (let lineNumber = firstH1.lineNumber + 1; lineNumber <= endLine; lineNumber++) {
    const line = lines[lineNumber - 1];
    const trimmed = line.trim();

    if (isAllowedUnderH1(trimmed)) {
      continue;
    }

    onError({
      lineNumber,
      detail:
        "Content under the first h1 heading is not allowed; only a table of contents (blank lines, list-of-links, badges, or HTML comments) is permitted.",
      context: line,
    });
  }
}

module.exports = {
  names: ["no-h1-content"],
  description:
    "Under the first h1 heading, allow only table-of-contents content (blank lines, list-of-links, badges, HTML comments).",
  tags: ["headings"],
  function: ruleFunction,
};
