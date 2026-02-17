"use strict";

const { extractHeadings, isRuleSuppressedByComment, pathMatchesAny } = require("./utils.js");

/** Match HTML comment line (single line). */
const RE_HTML_COMMENT = /^\s*<!--.*-->\s*$/;

/** Match list item that is a single anchor link: - [text](#id) or 1. [text](#id). */
const RE_TOC_LIST_ITEM = /^\s*([-*]|\d+\.)\s+\[.+\]\(#\S+\)\s*$/;

/** Match badge line(s): [![alt](img-url)](link-url) or [![alt][img-ref]][link-ref], optionally repeated. */
const RE_BADGE_LINE = /^\s*(\[!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])\](?:\([^)]*\)|\[[^\]]*\])\s*)+\s*$/;

/**
 * Update multi-line HTML comment state and return whether this line is part of a comment.
 *
 * @param {string} trimmed - Trimmed line
 * @param {{ inMultilineComment: boolean }} state - Current state
 * @returns {{ allowed: boolean, inMultilineComment: boolean }}
 */
function updateMultilineCommentState(trimmed, state) {
  if (state.inMultilineComment) {
    const closes = /-->\s*$/.test(trimmed);
    return { allowed: true, inMultilineComment: !closes };
  }
  if (RE_HTML_COMMENT.test(trimmed)) {
    return { allowed: true, inMultilineComment: false };
  }
  const opens = /^\s*<!--/.test(trimmed) && !/-->\s*$/.test(trimmed);
  return { allowed: opens, inMultilineComment: opens };
}

/**
 * Return true if the trimmed line is allowed under h1 (blank, TOC, badge, or HTML comment).
 * Single-line and multi-line HTML comments are allowed.
 *
 * @param {string} trimmed - Trimmed line
 * @param {{ isCommentLine: boolean }} multilineContext - When isCommentLine is true, line is part of multi-line comment
 * @returns {boolean}
 */
function isAllowedUnderH1(trimmed, multilineContext) {
  if (trimmed === "") {
    return true;
  }
  if (multilineContext && multilineContext.isCommentLine) {
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

function shouldSkipByPath(filePath, block) {
  const excludePatterns = block.excludePathPatterns;
  return Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns);
}

function getH1BlockRange(headings, lines) {
  const firstH1 = headings.find((h) => h.level === 1);
  if (!firstH1) return null;
  const nextHeading = headings.find((h) => h.lineNumber > firstH1.lineNumber);
  const endLine = nextHeading ? nextHeading.lineNumber - 1 : lines.length;
  return { startLine: firstH1.lineNumber + 1, endLine };
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
  const block = params.config?.["no-h1-content"] ?? params.config ?? {};
  if (shouldSkipByPath(filePath, block)) return;

  const headings = extractHeadings(lines);
  const range = getH1BlockRange(headings, lines);
  if (!range) return;

  let multilineCommentState = { inMultilineComment: false };
  for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber++) {
    const line = lines[lineNumber - 1];
    const trimmed = line.trim();
    const { allowed: isCommentLine, inMultilineComment } = updateMultilineCommentState(
      trimmed,
      multilineCommentState
    );
    multilineCommentState = { inMultilineComment };

    if (isAllowedUnderH1(trimmed, { isCommentLine })) continue;
    if (isRuleSuppressedByComment(lines, lineNumber, "no-h1-content")) continue;

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
