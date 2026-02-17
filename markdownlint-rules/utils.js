"use strict";

/**
 * Shared helpers for markdownlint custom rules.
 * Used by heading and prose rules (duplicate headings, numbering, ASCII, arrows).
 */

const RE_ATX_HEADING = /^(#{1,6})\s+(.+)$/;
const RE_NUMBERING_PREFIX = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/;

/**
 * Strip inline code spans from a line (multi-backtick aware).
 * Replaces content inside backticks with spaces so it is not matched by prose rules.
 *
 * @param {string} line - Raw line
 * @returns {string} Line with inline code spans replaced by spaces (backticks preserved)
 */
function stripInlineCode(line) {
  let out = "";
  let inCode = false;
  let fence = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch !== "`") {
      out += inCode ? " " : ch;
      continue;
    }

    let j = i;
    while (j < line.length && line[j] === "`") {
      j++;
    }
    const run = line.slice(i, j);

    if (!inCode) {
      inCode = true;
      fence = run;
    } else if (run === fence) {
      inCode = false;
      fence = "";
    }

    out += run;
    i = j - 1;
  }

  return out;
}

/**
 * Iterate over lines that are outside fenced code blocks (``` and ~~~).
 *
 * @param {string[]} lines - All lines
 * @yields {{ lineNumber: number, line: string, trimmed: string }}
 */
function* iterateNonFencedLines(lines) {
  let inFence = false;
  let fenceMarker = null;

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] === "`" ? "```" : "~~~";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    yield { lineNumber, line, trimmed };
  }
}

/**
 * Extract ATX headings (# through ######) from lines, skipping fenced blocks.
 *
 * @param {string[]} lines - All lines
 * @returns {{ lineNumber: number, level: number, rawText: string }[]}
 */
function extractHeadings(lines) {
  const result = [];
  for (const { lineNumber, line } of iterateNonFencedLines(lines)) {
    const content = line.replace(/^\s+/, "");
    const match = content.match(RE_ATX_HEADING);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      result.push({ lineNumber, level, rawText });
    }
  }
  return result;
}

/**
 * Parse heading text for a numbering prefix and optional H2 period.
 *
 * @param {string} text - Heading text (e.g. "1.2.3 Title" or "1. Title")
 * @returns {{ numbering: string|null, hasH2Dot: boolean, titleText: string }}
 */
function parseHeadingNumberPrefix(text) {
  const titleText = text.trim();
  const numMatch = titleText.match(RE_NUMBERING_PREFIX);
  if (!numMatch) {
    return { numbering: null, hasH2Dot: false, titleText };
  }

  const numbering = numMatch[1];
  const after = numMatch[2].trim();
  const hasH2Dot = numMatch[0].startsWith(numbering + ".");
  return {
    numbering,
    hasH2Dot,
    titleText: after,
  };
}

/**
 * Get 1-based edit column and length of the number prefix on the heading line for fixInfo.
 * @param {number} level - ATX heading level (number of #)
 * @param {string} rawText - Content after ATX (e.g. "1.2 Title")
 * @param {string|null} numbering - Current numbering string or null if none
 * @param {boolean} hasH2Dot - Whether there is a period after the number
 * @returns {{ editColumn: number, deleteCount: number }}
 */
function getNumberPrefixSpan(level, rawText, numbering, hasH2Dot) {
  const editColumn = level + 2;
  if (numbering == null || numbering === "") {
    return { editColumn, deleteCount: 0 };
  }
  const prefixLength = numbering.length + (hasH2Dot ? 1 : 0) + 1;
  return { editColumn, deleteCount: prefixLength };
}

/** Build insertText for expected number prefix (expected + optional period + space). */
function insertTextForExpectedNumber(expected, usePeriod) {
  return expected != null ? expected + (usePeriod ? "." : "") + " " : "";
}

/**
 * Normalize heading title for duplicate comparison: trim, collapse whitespace, lowercase.
 *
 * @param {string} titleText - Title part of heading (may already have numbering stripped)
 * @returns {string}
 */
function normalizeHeadingTitleForDup(titleText) {
  if (!titleText || typeof titleText !== "string") {
    return "";
  }
  return titleText
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Get normalized title for duplicate check: strip numbering then normalize.
 *
 * @param {string} rawText - Full heading text after #
 * @returns {string}
 */
function normalizedTitleForDuplicate(rawText) {
  const { titleText } = parseHeadingNumberPrefix(rawText);
  return normalizeHeadingTitleForDup(titleText);
}

/**
 * Convert glob pattern to RegExp. Supports ** (any path) and * (segment).
 * @param {string} pattern - Glob pattern (e.g. ** for path, * for segment)
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const parts = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      parts.push(".*");
      i += 2;
    } else if (pattern[i] === "*") {
      parts.push("[^/]*");
      i += 1;
    } else {
      parts.push(pattern[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
      i += 1;
    }
  }
  // Built from escaped glob segments only (.*, [^/]*, or escaped chars) — safe.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp("^" + parts.join("") + "$");
}

/**
 * Match path against a single glob pattern. Path normalized to forward slashes.
 * Relative patterns match when path starts with pattern or pattern appears mid-path.
 * @param {string} path - File path to test
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function matchGlob(path, pattern) {
  if (!path || !pattern) {
    return false;
  }
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const re = globToRegExp(pattern);
  if (re.test(normalized)) {
    return true;
  }
  const isRelative =
    pattern[0] !== "/" && pattern[0] !== "*" && !pattern.startsWith("./");
  if (isRelative) {
    return globToRegExp("**/" + pattern).test(normalized);
  }
  return false;
}

/**
 * Return true if a trimmed line is solely or ends with the rule's suppress comment (raw or cleared form).
 *
 * @param {string} trimmed - Trimmed line
 * @param {string} ruleName - Rule name (e.g. "no-empty-heading")
 * @returns {boolean}
 */
function trimmedLineMatchesSuppress(trimmed, ruleName) {
  const escaped = ruleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const n = ruleName.length;
  /* eslint-disable security/detect-non-literal-regexp -- ruleName escaped above; used for suppress comment match */
  const commentOnly = new RegExp(`^\\s*<!--\\s*${escaped}\\s+allow\\s*-->\\s*$`);
  const endsWithComment = new RegExp(`<!--\\s*${escaped}\\s+allow\\s*-->\\s*$`);
  const clearedCommentOnly = new RegExp(`^\\s*<!--\\s*\\.{${n}}\\s+\\.{5}\\s*-->\\s*$`);
  const clearedEndsWithComment = new RegExp(`<!--\\s*\\.{${n}}\\s+\\.{5}\\s*-->\\s*$`);
  /* eslint-enable security/detect-non-literal-regexp */
  return commentOnly.test(trimmed) || endsWithComment.test(trimmed)
    || clearedCommentOnly.test(trimmed) || clearedEndsWithComment.test(trimmed);
}

function isValidSuppressArgs(lines, lineNumber, ruleName) {
  return Array.isArray(lines) && lineNumber >= 1 && lineNumber <= lines.length
    && typeof ruleName === "string" && ruleName.length > 0;
}

/**
 * Return true if a violation at the given line is suppressed by an HTML comment.
 * Suppression: (1) the line immediately before lineNumber is solely
 * `<!-- ruleName allow -->` (optional whitespace), or (2) the line at lineNumber
 * ends with that comment (e.g. inline at end of line).
 * Example: `<!-- no-empty-heading allow -->` on the previous line or at end of line.
 *
 * @param {string[]} lines - All document lines (1-based index: line at lines[lineNumber - 1])
 * @param {number} lineNumber - 1-based line number of the violation
 * @param {string} ruleName - Rule name (e.g. "no-empty-heading")
 * @returns {boolean}
 */
function isRuleSuppressedByComment(lines, lineNumber, ruleName) {
  if (!isValidSuppressArgs(lines, lineNumber, ruleName)) return false;
  const currentLine = lines[lineNumber - 1];
  if (currentLine == null) return false;
  if (trimmedLineMatchesSuppress(String(currentLine).trim(), ruleName)) return true;
  if (lineNumber < 2) return false;
  const prevLine = lines[lineNumber - 2];
  return prevLine != null && trimmedLineMatchesSuppress(String(prevLine).trim(), ruleName);
}

/**
 * Return true if path matches any of the glob patterns.
 * @param {string} path - File path to test
 * @param {string[]} patterns - Glob patterns
 * @returns {boolean}
 */
function pathMatchesAny(path, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  for (const p of patterns) {
    if (typeof p === "string" && matchGlob(path, p)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse fence line (e.g. "```text" or "~~~") to get info string (first word, lowercased).
 * @param {string} line - Fence delimiter line
 * @returns {string} Block type or ""
 */
function parseFenceInfo(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(```+|~~~+)\s*(\S*)/);
  if (!match) {
    return "";
  }
  const rest = match[2].trim();
  const first = rest.split(/\s+/)[0] || "";
  return first.toLowerCase();
}

/**
 * Iterate all lines with fence state; yields { lineNumber, line, inFencedBlock, blockType } for each line.
 * Fence delimiter lines are not yielded; blockType is the info string (first word) of the opening fence.
 * @param {string[]} lines - All lines
 * @yields {{ lineNumber: number, line: string, inFencedBlock: boolean, blockType: string }}
 */
function* iterateLinesWithFenceInfo(lines) {
  let inFence = false;
  let fenceMarker = null;
  let blockType = "";

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0] === "`" ? "```" : "~~~";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        blockType = parseFenceInfo(line);
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
        blockType = "";
      }
      continue;
    }

    yield { lineNumber, line, inFencedBlock: inFence, blockType };
  }
}

/** Match link-reference definition line (e.g. [id]: https://...). */
const RE_LINK_REF_DEF = /^\[[^\]]+\]:\s/;
/** Match ATX heading. */
const RE_ATX_HEADING_LINE = /^#{1,6}\s+/;
/** Match thematic break (---, ***, ___). */
const RE_THEMATIC_BREAK = /^(\s*)([-*_])\s*\2\2\s*$/;

function isProseBlank(trimmed, line) {
  return trimmed === "" || /^\s*$/.test(line);
}

function updateFrontMatterState(trimmed, lineNumber, inFrontMatter) {
  if (trimmed !== "---" && !/^---\s*$/.test(trimmed)) {
    return { toggled: false, inFrontMatter };
  }
  const open = lineNumber === 1;
  const close = inFrontMatter && lineNumber > 1;
  return { toggled: true, inFrontMatter: open ? true : (close ? false : inFrontMatter) };
}

function isProseSkipLine(ctx) {
  if (RE_LINK_REF_DEF.test(ctx.trimmed)) return true;
  if (ctx.hasPipe && ctx.prevHadPipe && ctx.inTable) return true;
  if (RE_ATX_HEADING_LINE.test(ctx.trimmed)) return true;
  if (RE_THEMATIC_BREAK.test(ctx.line)) return true;
  return false;
}

/**
 * Iterate over lines that are prose (excludes fenced code, front matter, link refs,
 * table rows, ATX headings, thematic breaks, blank lines).
 * Table context: a line with | is skipped only when the previous line also had |
 * (two consecutive lines with |), to avoid false positives on single | in prose.
 *
 * @param {string[]} lines - All lines
 * @yields {{ lineNumber: number, line: string, trimmed: string }}
 */
function* iterateProseLines(lines) {
  let inFrontMatter = false;
  let prevHadPipe = false;
  let inTable = false;

  for (const { lineNumber, line, trimmed } of iterateNonFencedLines(lines)) {
    const hasPipe = line.includes("|");

    if (isProseBlank(trimmed, line)) {
      inTable = false;
      prevHadPipe = false;
      continue;
    }

    const fm = updateFrontMatterState(trimmed, lineNumber, inFrontMatter);
    if (fm.toggled) {
      inFrontMatter = fm.inFrontMatter;
      prevHadPipe = false;
      inTable = false;
      if (lineNumber === 1 || inFrontMatter) continue;
    }
    if (inFrontMatter) {
      prevHadPipe = false;
      inTable = false;
      continue;
    }

    if (hasPipe) {
      if (prevHadPipe) inTable = true;
      prevHadPipe = true;
    } else {
      inTable = false;
      prevHadPipe = false;
    }

    if (isProseSkipLine({ trimmed, line, hasPipe, prevHadPipe, inTable })) continue;

    yield { lineNumber, line, trimmed };
  }
}

module.exports = {
  stripInlineCode,
  iterateNonFencedLines,
  iterateProseLines,
  iterateLinesWithFenceInfo,
  parseFenceInfo,
  extractHeadings,
  parseHeadingNumberPrefix,
  getNumberPrefixSpan,
  insertTextForExpectedNumber,
  normalizeHeadingTitleForDup,
  normalizedTitleForDuplicate,
  globToRegExp,
  matchGlob,
  pathMatchesAny,
  isRuleSuppressedByComment,
  RE_ATX_HEADING,
  RE_NUMBERING_PREFIX,
};
