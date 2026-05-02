"use strict";

const { stripInlineCode } = require("./utils.js");

/** Abbreviations that do not end a sentence (no trailing period in value). */
const DEFAULT_ABBREVIATIONS = new Set([
  "e.g", "i.e", "etc", "vs", "Dr", "Mr", "Mrs", "Ms", "Prof", "Sr", "Jr",
  "U.S", "U.K", "a.m", "p.m", "No", "al", "fig",
]);

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

/** Compact token bounds ending at i (exclusive): [start, end=i). */
function getCompactTokenBoundsBefore(scanned, i) {
  let k = i - 1;
  while (k >= 0 && /[A-Za-z0-9_.-]/.test(scanned[k])) {
    k--;
  }
  return { start: k + 1, end: i };
}

/** Previous non-space character index before `pos`, or -1. */
function previousNonSpaceIndex(scanned, pos) {
  let k = pos - 1;
  while (k >= 0 && scanned[k] === " ") k--;
  return k;
}

/**
 * Compact number labels are only treated as non-boundaries when they look like
 * leading labels (line/sentence start, optional emphasis/quote/open-bracket).
 */
function looksLikeLeadingLabel(scanned, tokenStart) {
  const prev = previousNonSpaceIndex(scanned, tokenStart);
  if (prev < 0) return true;
  return /[*_"'([{]/.test(scanned[prev]);
}

/** True when period at i follows a compact label token containing digits (e.g. D1., 2.1.). */
function isCompactNumberLabel(scanned, i) {
  if (scanned[i] !== ".") return false;
  const bounds = getCompactTokenBoundsBefore(scanned, i);
  const token = scanned.slice(bounds.start, bounds.end);
  if (token.length === 0 || !/\d/.test(token)) return false;
  if (token.includes("..") || token.startsWith(".") || token.endsWith(".")) return false;
  if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(token)) return false;
  return looksLikeLeadingLabel(scanned, bounds.start);
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
  if (!after) return null;
  if (scanned[i] === "." && isCompactNumberLabel(scanned, i)) return null;
  if (isAbbreviation(scanned, i, after.j, abbreviations)) return null;
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

module.exports = {
  DEFAULT_ABBREVIATIONS,
  getFirstSentenceBoundary,
  getAllSentenceBoundaries,
  getWordBefore,
};
