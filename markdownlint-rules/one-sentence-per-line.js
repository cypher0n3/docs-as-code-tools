"use strict";

const {
  isRuleSuppressedByComment,
  isSubCheckSuppressedByComment,
  iterateProseBlocks,
  iterateProseLines,
  pathMatchesAny,
  stripInlineCode,
} = require("./utils.js");

/** Regex: optional indent, numbered list marker, then content. */
const RE_NUMBERED = /^(\s*)(\d+\.)\s+(.*)$/;
/** Regex: optional indent, bullet marker (-, *, +), then content. */
const RE_BULLET = /^(\s*)([-*+])\s+(\s*)(.*)$/;

/** Abbreviations that do not end a sentence (no trailing period in value). */
const DEFAULT_ABBREVIATIONS = new Set([
  "e.g", "i.e", "etc", "vs", "Dr", "Mr", "Mrs", "Ms", "Prof", "Sr", "Jr",
  "U.S", "U.K", "a.m", "p.m", "No", "al", "fig",
]);

/**
 * Get list/paragraph context for a line.
 * @param {string} line - Full line
 * @returns {{ indent: string, type: 'numbered'|'bullet'|'paragraph', content: string, contentIndent: number }}
 */
function getListInfo(line) {
  const numbered = line.match(RE_NUMBERED);
  if (numbered) {
    const indent = numbered[1];
    const marker = numbered[2];
    const content = numbered[3];
    const contentIndent = indent.length + marker.length + 1;
    return { indent, type: "numbered", content, contentIndent };
  }
  const bullet = line.match(RE_BULLET);
  if (bullet) {
    const indent = bullet[1];
    const marker = bullet[2];
    const rest = bullet[3] + bullet[4];
    const contentIndent = indent.length + marker.length + 1 + bullet[3].length;
    return { indent, type: "bullet", content: rest, contentIndent };
  }
  const indentMatch = line.match(/^(\s*)(.*)$/);
  const indent = indentMatch ? indentMatch[1] : "";
  const content = indentMatch ? indentMatch[2] : line;
  return {
    indent,
    type: "paragraph",
    content,
    contentIndent: indent.length,
  };
}

function updateBracketDepth(ch, inBracket, inParen) {
  if (ch === "[" && inParen === 0) return { inBracket: inBracket + 1, inParen };
  if (ch === "]" && inParen === 0) return { inBracket: inBracket - 1, inParen };
  if (ch === "(" && inBracket === 0) return { inBracket, inParen: inParen + 1 };
  if (ch === ")" && inBracket === 0) return { inBracket, inParen: inParen - 1 };
  return null;
}

/** Toggle inDoubleQuote on unescaped "; return new state or null to leave unchanged. */
function updateDoubleQuote(ch, inDoubleQuote, i, scanned) {
  if (ch !== '"') return null;
  if (i > 0 && scanned[i - 1] === "\\") return null;
  return !inDoubleQuote;
}

function isSentenceEndChar(ch) {
  return ch === "." || ch === "?" || ch === "!";
}

/** True when the period at i is part of an ellipsis (two or more consecutive dots). */
function isPartOfEllipsis(scanned, i) {
  if (scanned[i] !== ".") return false;
  return (i > 0 && scanned[i - 1] === ".") || (i + 1 < scanned.length && scanned[i + 1] === ".");
}

/** Index of the last character of a run of dots starting at i (i is a dot). */
function endOfEllipsisRun(scanned, i) {
  let end = i;
  while (end < scanned.length && scanned[end] === ".") end++;
  return end;
}

/** True when the content after the ellipsis (after optional space) starts with an uppercase letter. */
function capitalAfterEllipsis(scanned, lastDotIndex) {
  const spaceStart = skipQuotesThenSpace(scanned, lastDotIndex);
  if (spaceStart === null) return false;
  const after = spaceStartAndNextWordPos(scanned, spaceStart);
  if (!after) return false;
  return /[A-Z]/.test(scanned[after.j]);
}

function skipQuotesAndSpaces(scanned, j) {
  let pos = j;
  while (pos < scanned.length && (scanned[pos] === "*" || scanned[pos] === "_")) {
    pos++;
  }
  while (pos < scanned.length && (scanned[pos] === "'" || scanned[pos] === '"')) {
    pos++;
  }
  const spaceStart = pos;
  while (pos < scanned.length && scanned[pos] === " ") {
    pos++;
  }
  return { spaceStart, nextPos: pos };
}

function getWordBefore(scanned, endIndex) {
  let k = endIndex - 1;
  while (k >= 0 && /[a-zA-Z.]/.test(scanned[k])) {
    k--;
  }
  return scanned.slice(k + 1, endIndex);
}

function getNextToken(scanned, startIndex) {
  let m = startIndex;
  while (m < scanned.length && /[a-zA-Z.]/.test(scanned[m])) {
    m++;
  }
  return scanned.slice(startIndex, m).replace(/\.+$/, "");
}

/** Token before position i that may be a number (digits, optional .digits). */
function getNumberTokenBefore(scanned, i) {
  let k = i - 1;
  while (k >= 0 && /[\d.]/.test(scanned[k])) {
    k--;
  }
  return scanned.slice(k + 1, i);
}

/** True when period at i is part of a numbering label (e.g. "1. Overview", "1.1 Scope") inside quotes. */
function isNumberingLabel(scanned, i) {
  if (scanned[i] !== "." || i <= 0 || !/\d/.test(scanned[i - 1])) return false;
  const spaceStart = skipQuotesThenSpace(scanned, i);
  if (spaceStart === null) return false;
  const after = spaceStartAndNextWordPos(scanned, spaceStart);
  if (!after) return false;
  const nextToken = getNextToken(scanned, after.j);
  const numToken = getNumberTokenBefore(scanned, i);
  return /^\d+(\.\d+)*$/.test(numToken) && /^[A-Z]/.test(nextToken);
}

function isAbbreviation(scanned, i, j, abbreviations) {
  if (scanned[i] === "." && i > 0 && /\d/.test(scanned[i - 1])) {
    const nextToken = getNextToken(scanned, j);
    if (/^\d/.test(nextToken)) return true;
    return false;
  }
  const word = getWordBefore(scanned, i);
  if (word.length === 0) return false;
  const nextToken = getNextToken(scanned, j);
  const wordWithNext = word + "." + nextToken;
  const wordLower = word.toLowerCase();
  const wordWithNextLower = wordWithNext.toLowerCase();
  return abbreviations.has(word) || abbreviations.has(wordLower)
    || abbreviations.has(wordWithNext) || abbreviations.has(wordWithNextLower);
}

/** Skip optional emphasis (* _), then optional quotes after position i; return position of first space, or null. Period only counts as sentence end when followed by space (not e.g. CYNAI.PROJCT or file.name). */
function skipQuotesThenSpace(scanned, i) {
  let pos = i + 1;
  while (pos < scanned.length && (scanned[pos] === "*" || scanned[pos] === "_")) {
    pos++;
  }
  while (pos < scanned.length && (scanned[pos] === "'" || scanned[pos] === '"')) {
    pos++;
  }
  if (pos >= scanned.length || scanned[pos] !== " ") return null;
  return pos;
}

/** From start of spaces, skip spaces and return { spaceStart, j } or null if no word char follows. */
function spaceStartAndNextWordPos(scanned, spaceStart) {
  let pos = spaceStart;
  while (pos < scanned.length && scanned[pos] === " ") {
    pos++;
  }
  const j = nextWordPosAfterEmphasis(scanned, pos);
  if (j === null) return null;
  return { spaceStart, j };
}

/** @returns {{ run: string, end: number }} */
function consumeBacktickRun(scanned, k) {
  const runStart = k;
  while (k < scanned.length && scanned[k] === "`") {
    k++;
  }
  return { run: scanned.slice(runStart, k), end: k };
}

/**
 * Advance past inline code if `pos` is on opening backticks; return index after closing fence.
 * Matches utils.stripInlineCode fence pairing.
 */
function skipPastInlineCode(scanned, pos) {
  if (pos >= scanned.length || scanned[pos] !== "`") return pos;
  const open = consumeBacktickRun(scanned, pos);
  const fence = open.run;
  let k = open.end;
  let inCode = true;
  while (k < scanned.length && inCode) {
    if (scanned[k] === "`") {
      const close = consumeBacktickRun(scanned, k);
      if (close.run === fence) inCode = false;
      k = close.end;
    } else {
      k++;
    }
  }
  return k;
}

function skipInlineSpaces(scanned, pos) {
  while (pos < scanned.length && scanned[pos] === " ") {
    pos++;
  }
  return pos;
}

function skipEmphasisAndQuoteChars(scanned, pos) {
  while (pos < scanned.length && (scanned[pos] === "*" || scanned[pos] === "_")) {
    pos++;
  }
  while (pos < scanned.length && (scanned[pos] === "'" || scanned[pos] === '"')) {
    pos++;
  }
  return pos;
}

/**
 * After position start, skip emphasis, quotes, and inline code spans; return position of first
 * [a-zA-Z0-9] starting the next word, or null.
 */
function nextWordPosAfterEmphasis(scanned, start) {
  let pos = start;
  while (pos < scanned.length) {
    pos = skipInlineSpaces(scanned, pos);
    if (pos >= scanned.length || scanned[pos] === "\n") return null;
    pos = skipEmphasisAndQuoteChars(scanned, pos);
    if (pos >= scanned.length) return null;
    if (scanned[pos] === "`") {
      pos = skipPastInlineCode(scanned, pos);
      continue;
    }
    if (scanned[pos] === "\n" || !/[a-zA-Z0-9]/.test(scanned[pos])) return null;
    return pos;
  }
  return null;
}

/**
 * Find index of the first sentence boundary (space before second sentence) in content.
 * Uses stripInlineCode; skips link/paren context; avoids decimals and abbreviations.
 * @param {string} content - Prose content (no list marker)
 * @param {{ abbreviations?: Set<string> }} opts - Optional abbreviations set
 * @returns {number|null} Index of space before second sentence, or null if at most one sentence
 */
function trySentenceBoundary(scanned, i, abbreviations) {
  const spaceStart = skipQuotesThenSpace(scanned, i);
  if (spaceStart === null) return null;
  const after = spaceStartAndNextWordPos(scanned, spaceStart);
  if (!after || isAbbreviation(scanned, i, after.j, abbreviations)) return null;
  return i > 0 ? after.spaceStart : null;
}

function getFirstSentenceBoundary(content, opts) {
  const all = getAllSentenceBoundaries(content, opts);
  return all.length > 0 ? all[0] : null;
}

/** True when position i should be skipped for sentence-boundary scanning (inside brackets/parens or quoted numbering). */
function shouldSkipForSentenceBoundary(ctx) {
  const { ch, scanned, inBracket, inParen, inDoubleQuote } = ctx;
  if (inBracket > 0 || inParen > 0) return true;
  if (inDoubleQuote && ch === "." && isNumberingLabel(scanned, ctx.i)) return true;
  return false;
}

/**
 * Process a potential sentence-end at i; return next index and optional boundary.
 * @returns {{ nextI: number, boundary: number|null }}
 */
function processSentenceEnd(scanned, i, abbreviations) {
  const ch = scanned[i];
  if (!isSentenceEndChar(ch)) return { nextI: i, boundary: null };
  if (ch === "." && isPartOfEllipsis(scanned, i)) {
    const end = endOfEllipsisRun(scanned, i);
    const lastDotIndex = end - 1;
    if (capitalAfterEllipsis(scanned, lastDotIndex)) {
      const boundary = trySentenceBoundary(scanned, lastDotIndex, abbreviations);
      if (boundary !== null) {
        const { nextPos: j } = skipQuotesAndSpaces(scanned, lastDotIndex + 1);
        return { nextI: j - 1, boundary };
      }
    }
    return { nextI: end - 1, boundary: null };
  }
  const boundary = trySentenceBoundary(scanned, i, abbreviations);
  if (boundary !== null) {
    const { nextPos: j } = skipQuotesAndSpaces(scanned, i + 1);
    return { nextI: j - 1, boundary };
  }
  return { nextI: i, boundary: null };
}

/**
 * Find all sentence boundary indices (space before each sentence after the first).
 * @param {string} content - Prose content (no list marker)
 * @param {{ abbreviations?: Set<string> }} opts - Optional abbreviations set
 * @returns {number[]} Indices of space before second, third, ... sentence (empty if at most one sentence)
 */
function getAllSentenceBoundaries(content, opts) {
  const abbreviations = opts?.abbreviations ?? DEFAULT_ABBREVIATIONS;
  const scanned = stripInlineCode(content);
  const boundaries = [];
  let i = 0;
  let inBracket = 0;
  let inParen = 0;
  let inDoubleQuote = false;

  while (i < scanned.length) {
    const ch = scanned[i];
    const dq = updateDoubleQuote(ch, inDoubleQuote, i, scanned);
    if (dq !== null) {
      inDoubleQuote = dq;
      i++;
      continue;
    }
    const depth = updateBracketDepth(ch, inBracket, inParen);
    if (depth !== null) {
      inBracket = depth.inBracket;
      inParen = depth.inParen;
      i++;
      continue;
    }
    if (shouldSkipForSentenceBoundary({ ch, i, scanned, inBracket, inParen, inDoubleQuote })) {
      i++;
      continue;
    }
    const { nextI, boundary } = processSentenceEnd(scanned, i, abbreviations);
    if (boundary !== null) boundaries.push(boundary);
    i = nextI + 1;
  }
  return boundaries;
}

/**
 * Build a pair of fixInfo objects that together join `currentLine` with
 * `nextLine` into one physical line. The primary fixInfo is applied to the
 * current (open) line and appends a single space followed by the next line's
 * left-trimmed content; the cleanup fixInfo deletes the next line entirely.
 *
 * markdownlint's applyFix is single-line, so the join must be split across
 * two errors; see `tmp/fixinfo_join_encoding.md` for the rationale.
 *
 * @param {string} currentLine - Physical line that ends mid-sentence
 * @param {string} nextLine - Next physical line inside the same prose block
 * @returns {{
 *   primary: { editColumn: number, deleteCount: number, insertText: string },
 *   cleanup: { deleteCount: number },
 * }}
 */
function buildJoinFixInfo(currentLine, nextLine) {
  const trimmed = currentLine.replace(/\s+$/, "");
  const trailingWhitespace = currentLine.length - trimmed.length;
  return {
    primary: {
      editColumn: trimmed.length + 1,
      deleteCount: trailingWhitespace,
      insertText: " " + nextLine.replace(/^\s+/, ""),
    },
    cleanup: { deleteCount: -1 },
  };
}

/**
 * Build fixInfo that splits all sentences in one pass (from first boundary to EOL).
 * @param {string} line - Full line
 * @param {{ content: string, contentIndent: number, type: string }} listInfo - From getListInfo
 * @param {number[]} boundaryIndices - Indices in listInfo.content of space before 2nd, 3rd, ... sentence
 * @param {{ continuationIndent: number, hasExplicitContinuation: boolean }} continuationOpts
 * @returns {{ editColumn: number, deleteCount: number, insertText: string }}
 */
function buildFixInfo(line, listInfo, boundaryIndices, continuationOpts) {
  const { continuationIndent, hasExplicitContinuation } = continuationOpts;
  const firstBoundary = boundaryIndices[0];
  const prefixLength = line.length - listInfo.content.length;
  const lineBoundaryIndex = prefixLength + firstBoundary;
  const continuationSpaces = listInfo.contentIndent === 0
    ? 0
    : (listInfo.type === "paragraph" && hasExplicitContinuation
      ? continuationIndent
      : listInfo.contentIndent);
  const indent = " ".repeat(continuationSpaces);
  const content = listInfo.content;
  const parts = [];
  for (let k = 0; k < boundaryIndices.length; k++) {
    const start = boundaryIndices[k];
    const end = k + 1 < boundaryIndices.length ? boundaryIndices[k + 1] : content.length;
    parts.push("\n" + indent + content.slice(start, end).replace(/^\s+/, ""));
  }
  const insertText = parts.join("");
  return {
    editColumn: lineBoundaryIndex + 1,
    deleteCount: line.length - lineBoundaryIndex,
    insertText,
  };
}

/** True when the trailing period at index i is part of an ellipsis run. */
function trailingPeriodIsEllipsis(scanned, i) {
  return i > 0 && scanned[i - 1] === ".";
}

/** True when the trailing period at index i terminates an abbreviation token. */
function trailingPeriodIsAbbreviation(scanned, i, abbreviations) {
  const word = getWordBefore(scanned, i);
  if (word.length === 0) return false;
  return abbreviations.has(word) || abbreviations.has(word.toLowerCase());
}

/** Resolve whether a trailing period at index i closes a sentence. */
function trailingPeriodIsSentenceEnd(scanned, i, abbreviations) {
  if (trailingPeriodIsEllipsis(scanned, i)) return false;
  if (trailingPeriodIsAbbreviation(scanned, i, abbreviations)) return false;
  return true;
}

/**
 * Strip Markdown inline links and images from `s` so that the remaining text
 * reflects only the visible prose. Handles inline (`[t](u)`, `![t](u)`),
 * reference (`[t][r]`, `![t][r]`), and shortcut (`[r]`) forms iteratively so
 * nested patterns such as `[![alt][ref1]][ref2]` fully collapse.
 *
 * @param {string} s - Input text (typically already inline-code stripped)
 * @returns {string} Text with link/image structures removed.
 */
function stripMarkdownLinksAndImages(s) {
  let prev;
  let cur = String(s ?? "");
  do {
    prev = cur;
    cur = cur.replace(/!?\[([^\][]*)\]\(([^)]*)\)/g, "");
  } while (cur !== prev);
  do {
    prev = cur;
    cur = cur.replace(/!?\[([^\][]*)\]\[([^\][]*)\]/g, "");
  } while (cur !== prev);
  do {
    prev = cur;
    cur = cur.replace(/!?\[([^\][]*)\]/g, "");
  } while (cur !== prev);
  return cur;
}

/**
 * Classify the resolved sentence-ending state of a physical line.
 * "ended" when the last non-whitespace character is a resolved sentence end
 * (`.`, `?`, or `!` — not part of a decimal, abbreviation, numbering label,
 * or ellipsis-inside-sentence), a trailing colon (`:`), or the line is
 * non-prose (only inline code and/or Markdown link/image structures).
 * Inline code is stripped before inspection so fenced content cannot flip
 * the state.
 *
 * @param {string} content - Physical line (may include leading indent or list marker)
 * @param {{ abbreviations?: Set<string> }} [opts] - Abbreviation override
 * @returns {"ended"|"open"}
 */
/** True when a code-stripped line has no visible prose (only links/images). */
function isNonProseLine(codeStripped) {
  const linkStripped = stripMarkdownLinksAndImages(codeStripped).trim();
  return !/[A-Za-z]/.test(linkStripped);
}

function classifyEndingPunctuation(trimmed, abbreviations) {
  const last = trimmed[trimmed.length - 1];
  if (last === ":" || last === "?" || last === "!") return "ended";
  if (last !== ".") return "open";
  const i = trimmed.length - 1;
  return trailingPeriodIsSentenceEnd(trimmed, i, abbreviations) ? "ended" : "open";
}

function getLineEndingState(content, opts) {
  const abbreviations = opts?.abbreviations ?? DEFAULT_ABBREVIATIONS;
  const codeStripped = stripInlineCode(String(content ?? ""));
  const trimmed = codeStripped.replace(/\s+$/, "");
  if (trimmed.length === 0) return "open";
  if (isNonProseLine(codeStripped)) return "ended";
  return classifyEndingPunctuation(trimmed, abbreviations);
}

function getRuleConfig(params) {
  const ruleConfig = params.config?.["one-sentence-per-line"] ?? params.config ?? {};
  const excludePathPatterns = ruleConfig.excludePathPatterns;
  const hasExplicitContinuation = Object.prototype.hasOwnProperty.call(ruleConfig, "continuationIndent");
  const continuationIndent = typeof ruleConfig.continuationIndent === "number" ? ruleConfig.continuationIndent : 4;
  const strictAbbreviations = ruleConfig.strictAbbreviations;
  const abbreviations = Array.isArray(strictAbbreviations)
    ? new Set(strictAbbreviations.map((s) => String(s).replace(/\.$/, "")))
    : DEFAULT_ABBREVIATIONS;
  const checkCrossLine = ruleConfig.checkCrossLine === true;
  const maxFileLinesForCrossLine = typeof ruleConfig.maxFileLinesForCrossLine === "number"
    ? ruleConfig.maxFileLinesForCrossLine
    : 1500;
  const maxBlockLinesForFix = typeof ruleConfig.maxBlockLinesForFix === "number"
    ? ruleConfig.maxBlockLinesForFix
    : 8;
  return {
    ruleConfig,
    excludePathPatterns,
    continuationIndent,
    hasExplicitContinuation,
    abbreviations,
    checkCrossLine,
    maxFileLinesForCrossLine,
    maxBlockLinesForFix,
  };
}

/** True when the given line begins a new list item (bullet or numbered marker). */
function isNewListItem(line) {
  return RE_BULLET.test(line) || RE_NUMBERED.test(line);
}

/**
 * True when a line is effectively an HTML comment block (standalone). Used to
 * exclude suppression comments and other inline HTML comment lines from the
 * cross-line wrap scan, since they are not prose that could wrap.
 */
function isHtmlCommentLine(line) {
  const trimmed = String(line ?? "").trim();
  return trimmed.startsWith("<!--") && trimmed.endsWith("-->");
}

/** Per-line scan: report any physical line that contains more than one sentence. */
function scanPerLine(params, onError, ruleCfg) {
  const { continuationIndent, hasExplicitContinuation, abbreviations } = ruleCfg;
  const lines = params.lines;
  for (const { lineNumber, line } of iterateProseLines(lines)) {
    const listInfo = getListInfo(line);
    if (!listInfo.content.trim()) continue;
    const boundaryIndices = getAllSentenceBoundaries(listInfo.content, { abbreviations });
    if (boundaryIndices.length === 0) continue;
    if (isRuleSuppressedByComment(lines, lineNumber, "one-sentence-per-line")) continue;
    const fixInfo = buildFixInfo(line, listInfo, boundaryIndices, {
      continuationIndent,
      hasExplicitContinuation,
    });
    onError({
      lineNumber,
      detail: "Use one sentence per line; this line contains multiple sentences.",
      context: line,
      fixInfo,
    });
  }
}

/**
 * Cross-line scan: flag consecutive prose-line pairs in the same block that
 * form a wrapped sentence. When the enclosing block fits within
 * `maxBlockLinesForFix`, emits a primary error on the open line with a
 * fixInfo that appends a space and the left-trimmed next-line content, plus
 * a secondary cleanup error on the next line with `deleteCount: -1` so
 * `markdownlint --fix` merges the two lines into one.
 */
function shouldSkipCrossLinePair(lines, current, next, abbreviations) {
  if (isHtmlCommentLine(current.line) || isHtmlCommentLine(next.line)) return true;
  if (getLineEndingState(current.line, { abbreviations }) === "ended") return true;
  if (isNewListItem(next.line)) return true;
  if (isRuleSuppressedByComment(lines, current.lineNumber, "one-sentence-per-line")) return true;
  if (isSubCheckSuppressedByComment(
    lines, current.lineNumber, "one-sentence-per-line", "check_cross_line"
  )) return true;
  return false;
}

function emitCrossLineWrap(current, next, onError, withFix) {
  const primaryError = {
    lineNumber: current.lineNumber,
    detail: "Sentence continues on next line; keep one sentence per physical line.",
    context: current.line,
  };
  if (!withFix) {
    onError(primaryError);
    return;
  }
  const join = buildJoinFixInfo(current.line, next.line);
  primaryError.fixInfo = join.primary;
  onError(primaryError);
  onError({
    lineNumber: next.lineNumber,
    detail: "Wrapped sentence continuation; --fix joins this line with the previous line.",
    context: next.line,
    fixInfo: join.cleanup,
  });
}

function scanCrossLine(params, onError, ruleCfg) {
  const { abbreviations, maxBlockLinesForFix } = ruleCfg;
  const lines = params.lines;
  for (const block of iterateProseBlocks(lines)) {
    const withinFixSize = block.length <= maxBlockLinesForFix;
    let firstWrapFixEmitted = false;
    for (let i = 0; i + 1 < block.length; i++) {
      const current = block[i];
      const next = block[i + 1];
      if (shouldSkipCrossLinePair(lines, current, next, abbreviations)) continue;
      const withFix = withinFixSize && !firstWrapFixEmitted;
      emitCrossLineWrap(current, next, onError, withFix);
      if (withFix) firstWrapFixEmitted = true;
    }
  }
}

/**
 * markdownlint rule: enforce one sentence per line in prose and list content.
 * The default (per-line) check reports one violation per line with multiple
 * sentences; `fixInfo` splits all boundaries in one pass.
 * When `checkCrossLine` is true, also reports wrapped sentences inside the
 * same prose block.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const filePath = params.name || "";
  const ruleCfg = getRuleConfig(params);
  const { excludePathPatterns, checkCrossLine, maxFileLinesForCrossLine } = ruleCfg;
  if (Array.isArray(excludePathPatterns) && excludePathPatterns.length > 0
      && pathMatchesAny(filePath, excludePathPatterns)) {
    return;
  }

  scanPerLine(params, onError, ruleCfg);

  if (!checkCrossLine) return;
  if (maxFileLinesForCrossLine > 0 && params.lines.length > maxFileLinesForCrossLine) return;
  scanCrossLine(params, onError, ruleCfg);
}

module.exports = {
  names: ["one-sentence-per-line"],
  description: "Enforce one sentence per line in prose and list content",
  tags: ["sentences", "style"],
  function: ruleFunction,
  getFirstSentenceBoundary,
  getAllSentenceBoundaries,
  getLineEndingState,
};
