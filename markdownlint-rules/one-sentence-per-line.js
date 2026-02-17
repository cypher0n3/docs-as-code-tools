"use strict";

const {
  isRuleSuppressedByComment,
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

function skipQuotesAndSpaces(scanned, j) {
  let pos = j;
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

/** Skip optional quotes after position i; return next position or null if no space follows. */
function skipQuotesThenSpace(scanned, i) {
  let pos = i + 1;
  while (pos < scanned.length && (scanned[pos] === "'" || scanned[pos] === '"')) {
    pos++;
  }
  if (pos >= scanned.length || scanned[pos] === "\n" || scanned[pos] !== " ") return null;
  return pos;
}

/** From start of spaces, skip spaces and return { spaceStart, j } or null if no word char follows. */
function spaceStartAndNextWordPos(scanned, spaceStart) {
  let pos = spaceStart;
  while (pos < scanned.length && scanned[pos] === " ") {
    pos++;
  }
  const j = pos;
  if (j >= scanned.length || scanned[j] === "\n" || !/[a-zA-Z0-9]/.test(scanned[j])) return null;
  return { spaceStart, j };
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
    if (!isSentenceEndChar(ch)) {
      i++;
      continue;
    }
    const boundary = trySentenceBoundary(scanned, i, abbreviations);
    if (boundary !== null) {
      boundaries.push(boundary);
      const { nextPos: j } = skipQuotesAndSpaces(scanned, i + 1);
      i = j - 1;
    }
    i++;
  }
  return boundaries;
}

/**
 * Build fixInfo that splits all sentences in one pass (from first boundary to EOL).
 * @param {string} line - Full line
 * @param {{ content: string, contentIndent: number, type: string }} listInfo - From getListInfo
 * @param {number[]} boundaryIndices - Indices in listInfo.content of space before 2nd, 3rd, ... sentence
 * @param {number} defaultContinuationIndent - Default spaces for paragraph continuation
 * @returns {{ editColumn: number, deleteCount: number, insertText: string }}
 */
function buildFixInfo(line, listInfo, boundaryIndices, defaultContinuationIndent) {
  const firstBoundary = boundaryIndices[0];
  const prefixLength = line.length - listInfo.content.length;
  const lineBoundaryIndex = prefixLength + firstBoundary;
  const continuationSpaces = listInfo.type === "paragraph"
    ? (listInfo.contentIndent === 0 ? 0 : defaultContinuationIndent)
    : listInfo.contentIndent;
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

function getRuleConfig(params) {
  const ruleConfig = params.config?.["one-sentence-per-line"] ?? params.config ?? {};
  const excludePathPatterns = ruleConfig.excludePathPatterns;
  const continuationIndent = typeof ruleConfig.continuationIndent === "number" ? ruleConfig.continuationIndent : 4;
  const strictAbbreviations = ruleConfig.strictAbbreviations;
  const abbreviations = Array.isArray(strictAbbreviations)
    ? new Set(strictAbbreviations.map((s) => String(s).replace(/\.$/, "")))
    : DEFAULT_ABBREVIATIONS;
  return { ruleConfig, excludePathPatterns, continuationIndent, abbreviations };
}

/**
 * markdownlint rule: enforce one sentence per line in prose and list content.
 * Reports one violation per line with multiple sentences; fixInfo splits all boundaries in one pass.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const filePath = params.name || "";
  const { excludePathPatterns, continuationIndent, abbreviations } = getRuleConfig(params);
  if (Array.isArray(excludePathPatterns) && excludePathPatterns.length > 0 && pathMatchesAny(filePath, excludePathPatterns)) {
    return;
  }

  for (const { lineNumber, line } of iterateProseLines(lines)) {
    const listInfo = getListInfo(line);
    if (!listInfo.content.trim()) continue;
    const boundaryIndices = getAllSentenceBoundaries(listInfo.content, { abbreviations });
    if (boundaryIndices.length === 0) continue;
    if (isRuleSuppressedByComment(lines, lineNumber, "one-sentence-per-line")) continue;

    const fixInfo = buildFixInfo(line, listInfo, boundaryIndices, continuationIndent);
    onError({
      lineNumber,
      detail: "Use one sentence per line; this line contains multiple sentences.",
      context: line,
      fixInfo,
    });
  }
}

module.exports = {
  names: ["one-sentence-per-line"],
  description: "Enforce one sentence per line in prose and list content",
  tags: ["sentences", "style"],
  function: ruleFunction,
  getFirstSentenceBoundary,
  getAllSentenceBoundaries,
};
