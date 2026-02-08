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
  for (const { lineNumber, trimmed } of iterateNonFencedLines(lines)) {
    const match = trimmed.match(RE_ATX_HEADING);
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

module.exports = {
  stripInlineCode,
  iterateNonFencedLines,
  iterateLinesWithFenceInfo,
  parseFenceInfo,
  extractHeadings,
  parseHeadingNumberPrefix,
  normalizeHeadingTitleForDup,
  normalizedTitleForDuplicate,
  globToRegExp,
  matchGlob,
  pathMatchesAny,
  RE_ATX_HEADING,
  RE_NUMBERING_PREFIX,
};
