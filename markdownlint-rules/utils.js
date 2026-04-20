"use strict";

const path = require("node:path");

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
 * Relative inputs use `path.normalize` before matching so e.g. `docs/../README.md`
 * matches the same as `README.md`.
 *
 * Absolute file paths (as markdownlint-cli2 passes via `params.name`) are also
 * re-tested against their cwd-relative form so patterns like `defaults/*.md`
 * or `docs/requirements/**` written relative to the project root still match.
 *
 * A pattern with no `/` matches only project-root files: the path relative to
 * `process.cwd()` must be a single segment below cwd, or one `..` segment then a
 * filename (e.g. `../README.md` when linting from a subdir). Nested paths like
 * `docs/README.md` still require `**` in the pattern.
 * @param {string} filePath - File path to test (as markdownlint passes in `name`)
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function cwdRelative(filePath) {
  try {
    return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function matchSinglePatternFallback(re, relToCwd) {
  if (!relToCwd.startsWith("..") && !relToCwd.includes("/") && re.test(relToCwd)) {
    return true;
  }
  if (/^\.\.\/[^/]+$/.test(relToCwd) && re.test(path.basename(relToCwd))) {
    return true;
  }
  return false;
}

function matchGlob(filePath, pattern) {
  if (!filePath || !pattern) return false;
  const normalized = path.normalize(filePath).replace(/\\/g, "/").replace(/^\.\//, "");
  const re = globToRegExp(pattern);
  if (re.test(normalized)) return true;

  const relToCwd = cwdRelative(filePath);
  if (!relToCwd) return false;
  if (!relToCwd.startsWith("..") && re.test(relToCwd)) return true;
  if (!pattern.includes("/")) return matchSinglePatternFallback(re, relToCwd);
  return false;
}

/** Escape regex metacharacters for literal use inside a dynamic RegExp. */
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Token pattern body (escaped name, optionally followed by an escaped sub-check). */
function suppressNamePattern(ruleName, subCheck) {
  const base = escapeForRegex(ruleName);
  return subCheck ? `${base}\\s+${escapeForRegex(subCheck)}` : base;
}

/** Cleared-form token length (dots replacing ruleName, optional sub-check). */
function clearedNamePattern(ruleName, subCheck) {
  const base = `\\.{${ruleName.length}}`;
  return subCheck ? `${base}\\s+\\.{${subCheck.length}}` : base;
}

/**
 * Return true if a trimmed line is solely or ends with the rule's suppress comment (raw or cleared form).
 *
 * @param {string} trimmed - Trimmed line
 * @param {string} ruleName - Rule name (e.g. "no-empty-heading")
 * @param {string} [subCheck] - Optional sub-check token (e.g. "check_cross_line")
 * @returns {boolean}
 */
function trimmedLineMatchesSuppress(trimmed, ruleName, subCheck) {
  const namePattern = suppressNamePattern(ruleName, subCheck);
  const clearedPattern = clearedNamePattern(ruleName, subCheck);
  /* eslint-disable security/detect-non-literal-regexp -- patterns built from escaped ruleName */
  const commentOnly = new RegExp(`^\\s*<!--\\s*${namePattern}\\s+allow\\s*-->\\s*$`);
  const endsWithComment = new RegExp(`<!--\\s*${namePattern}\\s+allow\\s*-->\\s*$`);
  const clearedCommentOnly = new RegExp(`^\\s*<!--\\s*${clearedPattern}\\s+\\.{5}\\s*-->\\s*$`);
  const clearedEndsWithComment = new RegExp(`<!--\\s*${clearedPattern}\\s+\\.{5}\\s*-->\\s*$`);
  /* eslint-enable security/detect-non-literal-regexp */
  return commentOnly.test(trimmed) || endsWithComment.test(trimmed)
    || clearedCommentOnly.test(trimmed) || clearedEndsWithComment.test(trimmed);
}

function isValidSuppressArgs(lines, lineNumber, ruleName) {
  return Array.isArray(lines) && lineNumber >= 1 && lineNumber <= lines.length
    && typeof ruleName === "string" && ruleName.length > 0;
}

/** "disable" length for cleared-form regex. */
const DISABLE_LEN = 7;
/** "enable" length for cleared-form regex. */
const ENABLE_LEN = 6;

/** Build a whole-line regex matching "<!-- ruleName [subCheck] action -->" and its cleared form. */
function buildActionMatcher(ruleName, action, actionLen, subCheck) {
  const namePattern = suppressNamePattern(ruleName, subCheck);
  const clearedPattern = clearedNamePattern(ruleName, subCheck);
  /* eslint-disable security/detect-non-literal-regexp -- patterns built from escaped ruleName */
  const re = new RegExp(`^\\s*<!--\\s*${namePattern}\\s+${action}\\s*-->\\s*$`);
  const clearedRe = new RegExp(`^\\s*<!--\\s*${clearedPattern}\\s+\\.{${actionLen}}\\s*-->\\s*$`);
  /* eslint-enable security/detect-non-literal-regexp */
  return { re, clearedRe };
}

/**
 * Return true if the trimmed line is solely "<!-- ruleName disable -->" (whole-line only; optional whitespace).
 * Also matches markdownlint-cleared form: <!-- .{n} .{7} --> (dots replace rule name and "disable").
 */
function trimmedLineMatchesDisable(trimmed, ruleName, subCheck) {
  const { re, clearedRe } = buildActionMatcher(ruleName, "disable", DISABLE_LEN, subCheck);
  return re.test(trimmed) || clearedRe.test(trimmed);
}

/**
 * Return true if the trimmed line is solely "<!-- ruleName enable -->" (whole-line only; optional whitespace).
 * Also matches markdownlint-cleared form: <!-- .{n} .{6} --> (dots replace rule name and "enable").
 */
function trimmedLineMatchesEnable(trimmed, ruleName, subCheck) {
  const { re, clearedRe } = buildActionMatcher(ruleName, "enable", ENABLE_LEN, subCheck);
  return re.test(trimmed) || clearedRe.test(trimmed);
}

/**
 * Return true if the rule (or rule+subCheck) is in a disabled block at the given line.
 */
function isDisabledAtLine(lines, lineNumber, ruleName, subCheck) {
  if (!isValidSuppressArgs(lines, lineNumber, ruleName)) return false;
  let enabled = true;
  for (let i = 0; i < lineNumber; i++) {
    const trimmed = String(lines[i] ?? "").trim();
    if (trimmedLineMatchesDisable(trimmed, ruleName, subCheck)) enabled = false;
    else if (trimmedLineMatchesEnable(trimmed, ruleName, subCheck)) enabled = true;
  }
  return !enabled;
}

/**
 * Core helper: return true when a rule or sub-check is suppressed at `lineNumber`
 * by a disable/enable block, an on-line trailing allow comment, or an allow comment
 * on the nearest preceding non-blank line (blank lines are skipped).
 */
function isSuppressedByCommentCore(lines, lineNumber, ruleName, subCheck) {
  if (!isValidSuppressArgs(lines, lineNumber, ruleName)) return false;
  if (isDisabledAtLine(lines, lineNumber, ruleName, subCheck)) return true;
  const currentLine = lines[lineNumber - 1];
  if (currentLine == null) return false;
  if (trimmedLineMatchesSuppress(String(currentLine).trim(), ruleName, subCheck)) return true;
  if (lineNumber < 2) return false;
  for (let i = lineNumber - 2; i >= 0; i--) {
    const t = String(lines[i] ?? "").trim();
    if (t === "") continue;
    return trimmedLineMatchesSuppress(t, ruleName, subCheck);
  }
  return false;
}

/**
 * Return true if a violation at the given line is suppressed by an HTML comment.
 * Suppression: (1) the first non-blank line at or above lineNumber-1, scanning upward,
 * is solely `<!-- ruleName allow -->` (optional whitespace), or (2) the line at lineNumber
 * ends with that comment (e.g. inline at end of line), or (3) the line is inside
 * a disable block (between `<!-- ruleName disable -->` and `<!-- ruleName enable -->`).
 * Blank lines between the allow comment and the violating line are skipped so a
 * comment can sit above a spaced-out paragraph (common under H1 intros).
 *
 * @param {string[]} lines - All document lines (1-based index: line at lines[lineNumber - 1])
 * @param {number} lineNumber - 1-based line number of the violation
 * @param {string} ruleName - Rule name (e.g. "no-empty-heading")
 * @returns {boolean}
 */
function isRuleSuppressedByComment(lines, lineNumber, ruleName) {
  return isSuppressedByCommentCore(lines, lineNumber, ruleName);
}

/**
 * Return true if a specific sub-check of a rule is suppressed at the given line by an
 * HTML comment of the form `<!-- ruleName subCheck allow|disable|enable -->`.
 *
 * Mirrors `isRuleSuppressedByComment` exactly except that the comment must also include
 * the sub-check token after the rule name. Whole-rule suppression is NOT implied by this
 * helper; check `isRuleSuppressedByComment` separately when both forms should apply.
 *
 * @param {string[]} lines - All document lines
 * @param {number} lineNumber - 1-based line number of the violation
 * @param {string} ruleName - Rule name (e.g. "one-sentence-per-line")
 * @param {string} subCheck - Sub-check token (e.g. "check_cross_line")
 * @returns {boolean}
 */
function isSubCheckSuppressedByComment(lines, lineNumber, ruleName, subCheck) {
  if (typeof subCheck !== "string" || subCheck.length === 0) return false;
  return isSuppressedByCommentCore(lines, lineNumber, ruleName, subCheck);
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
 * Compile user-provided exception-pattern entries of the form
 * `{ pathGlobs?: string[], linePatterns: string[] }` into
 * `{ pathGlobs, regexes }`. Invalid regexes and malformed entries are
 * silently skipped so one bad pattern cannot disable the rest.
 */
function compileExceptionPatterns(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || !Array.isArray(entry.linePatterns)) continue;
    const regexes = [];
    for (const src of entry.linePatterns) {
      // eslint-disable-next-line security/detect-non-literal-regexp
      try { regexes.push(new RegExp(src)); } catch { /* invalid regex: skip */ }
    }
    if (regexes.length === 0) continue;
    const pathGlobs = Array.isArray(entry.pathGlobs) ? entry.pathGlobs : null;
    out.push({ pathGlobs, regexes });
  }
  return out;
}

/**
 * True when `line` matches any compiled exception entry applicable to
 * `filePath`. An entry's `pathGlobs` (if present) must match; a null or
 * empty `pathGlobs` means the entry applies to all paths.
 */
function lineMatchesException(line, filePath, compiledExceptions) {
  if (!Array.isArray(compiledExceptions) || compiledExceptions.length === 0) return false;
  const s = String(line ?? "");
  for (const entry of compiledExceptions) {
    if (entry.pathGlobs && entry.pathGlobs.length > 0
      && !pathMatchesAny(filePath, entry.pathGlobs)) continue;
    for (const re of entry.regexes) {
      if (re.test(s)) return true;
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

/**
 * Compute the set of 1-based line numbers that lie inside a multi-line HTML
 * comment (`<!-- ... -->` spanning two or more physical lines). Lines that are
 * themselves a fully self-contained `<!-- ... -->` on one line are not
 * included here (the cross-line scan filters those separately via
 * `isHtmlCommentLine` in the rule).
 *
 * @param {string[]} lines - All lines
 * @returns {Set<number>} Line numbers to treat as non-prose / block breaks.
 */
function computeMultiLineHtmlCommentLines(lines) {
  const result = new Set();
  let inside = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const lineNumber = i + 1;
    if (!inside) {
      const openIdx = line.indexOf("<!--");
      if (openIdx === -1) continue;
      const afterOpen = line.slice(openIdx + 4);
      if (afterOpen.includes("-->")) continue;
      inside = true;
      result.add(lineNumber);
      continue;
    }
    result.add(lineNumber);
    if (line.includes("-->")) inside = false;
  }
  return result;
}

/**
 * Iterate over contiguous prose blocks. A block is a maximal run of consecutive
 * lines yielded by `iterateProseLines` with no gap in line numbers (no blank
 * line, fenced code, heading, table row, HTML comment interior, etc. between
 * them).
 *
 * @param {string[]} lines - All lines
 * @yields {Array<{ lineNumber: number, line: string, trimmed: string }>}
 *   Non-empty array of prose lines making up one block, in document order.
 */
function* iterateProseBlocks(lines) {
  const htmlCommentLines = computeMultiLineHtmlCommentLines(lines);
  let block = [];
  let expectedNext = 0;
  for (const entry of iterateProseLines(lines)) {
    if (htmlCommentLines.has(entry.lineNumber)) {
      if (block.length > 0) {
        yield block;
        block = [];
      }
      expectedNext = 0;
      continue;
    }
    if (block.length === 0 || entry.lineNumber === expectedNext) {
      block.push(entry);
    } else {
      yield block;
      block = [entry];
    }
    expectedNext = entry.lineNumber + 1;
  }
  if (block.length > 0) yield block;
}

module.exports = {
  stripInlineCode,
  iterateNonFencedLines,
  iterateProseLines,
  iterateProseBlocks,
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
  compileExceptionPatterns,
  lineMatchesException,
  isRuleSuppressedByComment,
  isSubCheckSuppressedByComment,
  RE_ATX_HEADING,
  RE_NUMBERING_PREFIX,
};
