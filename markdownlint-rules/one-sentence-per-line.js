"use strict";

const {
  compileExceptionPatterns,
  isRuleSuppressedByComment,
  isSubCheckSuppressedByComment,
  iterateProseBlocks,
  iterateProseLines,
  lineMatchesException,
  pathMatchesAny,
  stripInlineCode,
} = require("./utils.js");

const {
  DEFAULT_ABBREVIATIONS,
  getFirstSentenceBoundary,
  getAllSentenceBoundaries,
  getWordBefore,
} = require("./one-sentence-per-line-sentence.js");

/** Regex: optional indent, numbered list marker, then content. */
const RE_NUMBERED = /^(\s*)(\d+\.)\s+(.*)$/;
/** Regex: optional indent, bullet marker (-, *, +), then content. */
const RE_BULLET = /^(\s*)([-*+])\s+(\s*)(.*)$/;

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

/**
 * Build a primary+cleanup fixInfo pair that collapses `currentLine` with its
 * downstream wrap `chainLines` into a single line. Each wrap in a multi-line
 * chain emits its own pair; applying them all in one `--fix` pass converges
 * the full chain. See `tmp/fixinfo_join_encoding.md` for the rationale.
 */
function buildJoinFixInfo(currentLine, chainLines) {
  const trimmed = currentLine.replace(/\s+$/, "");
  const joined = chainLines.map((l) => String(l).replace(/^\s+/, "")).join(" ");
  return {
    primary: { editColumn: trimmed.length + 1,
      deleteCount: currentLine.length - trimmed.length, insertText: " " + joined },
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
/** Trimmed slice segments of `content` at each boundary index. */
function splitContentSegments(content, boundaryIndices) {
  const segments = [];
  for (let k = 0; k <= boundaryIndices.length; k++) {
    const start = k === 0 ? 0 : boundaryIndices[k - 1];
    const end = k < boundaryIndices.length ? boundaryIndices[k] : content.length;
    segments.push(content.slice(start, end).replace(/^\s+/, "").replace(/\s+$/, ""));
  }
  return segments;
}

/** Insert text for whole-line emphasis: one wrapped line per sentence. */
function buildEmphasisWrappedInsertText(content, boundaryIndices, indent, wrapper) {
  const { open, close } = wrapper;
  const segments = splitContentSegments(content, boundaryIndices);
  const inner = segments.map((segment, idx) => {
    if (idx === 0) return segment.slice(open.length);
    if (idx === segments.length - 1) return segment.slice(0, -close.length);
    return segment;
  });
  const wrapped = inner.map((s) => `${open}${s}${close}`);
  const parts = [close];
  for (let k = 1; k < wrapped.length; k++) {
    parts.push("\n" + indent + wrapped[k]);
  }
  return parts.join("");
}

/** Insert text for plain split (no whole-line wrapper). */
function buildPlainSplitInsertText(content, boundaryIndices, indent) {
  const parts = [];
  for (let k = 0; k < boundaryIndices.length; k++) {
    const end = k + 1 < boundaryIndices.length ? boundaryIndices[k + 1] : content.length;
    parts.push("\n" + indent + content.slice(boundaryIndices[k], end).replace(/^\s+/, ""));
  }
  return parts.join("");
}

function buildFixInfo(line, listInfo, boundaryIndices, continuationOpts) {
  const { continuationIndent, hasExplicitContinuation } = continuationOpts;
  const firstBoundary = boundaryIndices[0];
  const lineBoundaryIndex = line.length - listInfo.content.length + firstBoundary;
  const continuationSpaces = listInfo.contentIndent === 0 ? 0
    : (listInfo.type === "paragraph" && hasExplicitContinuation
      ? continuationIndent : listInfo.contentIndent);
  const indent = " ".repeat(continuationSpaces);
  const content = listInfo.content;
  const wrapper = getFullLineEmphasisWrapper(content);
  const insertText = wrapper
    ? buildEmphasisWrappedInsertText(content, boundaryIndices, indent, wrapper)
    : buildPlainSplitInsertText(content, boundaryIndices, indent);
  return {
    editColumn: lineBoundaryIndex + 1,
    deleteCount: line.length - lineBoundaryIndex,
    insertText,
  };
}

/**
 * Format one prose or list line so every detected sentence occupies its own
 * physical line. This is shared with rules that generate Markdown content.
 *
 * @param {string} line - Full Markdown line
 * @param {{ abbreviations?: Set<string> }} [opts] - Sentence-boundary options
 * @returns {string} Original or sentence-split line
 */
function formatLineAsOneSentencePerLine(line, opts) {
  const listInfo = getListInfo(line);
  const boundaryIndices = getAllSentenceBoundaries(listInfo.content, opts);
  if (boundaryIndices.length === 0) return line;
  const fixInfo = buildFixInfo(line, listInfo, boundaryIndices, {
    continuationIndent: 4,
    hasExplicitContinuation: false,
  });
  const editIndex = fixInfo.editColumn - 1;
  return line.slice(0, editIndex) + fixInfo.insertText;
}

/** Detect whole-content emphasis wrapper (e.g. **...**, *...*, _..._, ~~...~~). */
function getFullLineEmphasisWrapper(content) {
  const TOKENS = ["**", "__", "~~", "*", "_"];
  for (const token of TOKENS) {
    if (!content.startsWith(token) || !content.endsWith(token)) continue;
    if (content.length <= token.length * 2) continue;
    return { open: token, close: token };
  }
  return null;
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
 * Strip Markdown inline/reference/shortcut links and images iteratively so
 * nested forms fully collapse. Used to detect "non-prose" lines.
 */
function stripMarkdownLinksAndImages(s) {
  const PATTERNS = [
    /!?\[([^\][]*)\]\(([^)]*)\)/g,
    /!?\[([^\][]*)\]\[([^\][]*)\]/g,
    /!?\[([^\][]*)\]/g,
  ];
  let cur = String(s ?? "");
  for (const re of PATTERNS) {
    let prev;
    do { prev = cur; cur = cur.replace(re, ""); } while (cur !== prev);
  }
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
/** True when a code-stripped line has no visible prose. A non-empty inline code span (matched backticks with content) counts as prose so continuations like `` `foo`, `bar`. `` are not mis-classified. */
function isNonProseLine(codeStripped) {
  if (/`+[^`]+`+/.test(codeStripped)) return false;
  const stripped = stripMarkdownLinksAndImages(codeStripped).replace(/<[^>]+>/g, "");
  return !/[A-Za-z]/.test(stripped);
}

function classifyEndingPunctuation(trimmed, abbreviations) {
  if (trimmed.length === 0) return "open";
  const last = trimmed[trimmed.length - 1];
  if (last === ":" || last === "?" || last === "!") return "ended";
  if (last !== ".") return "open";
  const i = trimmed.length - 1;
  return trailingPeriodIsSentenceEnd(trimmed, i, abbreviations) ? "ended" : "open";
}

/**
 * Strip trailing Markdown emphasis markers (`**`, `__`, `~~`, `*`, `_`) and
 * trailing link/image/reference structures so a wrapped sentence like
 * `**Hello.**` or `Hello. [docs](…)` reveals its true terminal punctuation.
 */
/**
 * Iteratively strip trailing whitespace, emphasis markers, inline
 * links/images, HTML tags, and closing quote characters (straight and
 * typographic). Each regex is individually anchored at `$` to avoid
 * catastrophic backtracking on long whitespace runs (a single combined
 * alternation with `+$` would explore exponentially many partitions
 * before giving up on an unmatched end). Stripping trailing quotes lets
 * sentence-ending punctuation immediately inside a quoted phrase (e.g.
 * `"...was supplied."` or `"...right replacement?"`) be detected as a
 * sentence end rather than leaving the line classified as `"open"`.
 */
const TRAIL_REGEXES = [
  /\s+$/,
  /<[^>]+>$/,
  /!?\[[^\][]*\](?:\([^)]*\)|\[[^\][]*\])?$/,
  /(?:\*\*|__|~~|\*|_)$/,
  /["'\u201c\u201d\u2018\u2019]$/,
];
function stripTrailingStructuralMarkers(s) {
  let prev;
  let cur = s;
  do {
    prev = cur;
    for (const re of TRAIL_REGEXES) cur = cur.replace(re, "");
  } while (cur !== prev);
  return cur;
}

function getLineEndingState(content, opts) {
  const abbreviations = opts?.abbreviations ?? DEFAULT_ABBREVIATIONS;
  const codeStripped = stripInlineCode(String(content ?? ""));
  const trimmed = codeStripped.replace(/\s+$/, "");
  if (trimmed.length === 0) return "open";
  if (isNonProseLine(codeStripped)) return "ended";
  const stripped = stripTrailingStructuralMarkers(trimmed);
  return classifyEndingPunctuation(stripped, abbreviations);
}

function getRuleConfig(params) {
  const ruleConfig = params.config?.["one-sentence-per-line"] ?? params.config ?? {};
  const hasExplicitContinuation = Object.prototype.hasOwnProperty.call(ruleConfig, "continuationIndent");
  const numOrDefault = (v, d) => (typeof v === "number" ? v : d);
  const strictAbbreviations = ruleConfig.strictAbbreviations;
  return {
    ruleConfig,
    excludePathPatterns: ruleConfig.excludePathPatterns,
    continuationIndent: numOrDefault(ruleConfig.continuationIndent, 4),
    hasExplicitContinuation,
    abbreviations: Array.isArray(strictAbbreviations)
      ? new Set(strictAbbreviations.map((s) => String(s).replace(/\.$/, "")))
      : DEFAULT_ABBREVIATIONS,
    checkCrossLine: ruleConfig.checkCrossLine === true,
    maxFileLinesForCrossLine: numOrDefault(ruleConfig.maxFileLinesForCrossLine, 1500),
    maxBlockLinesForFix: numOrDefault(ruleConfig.maxBlockLinesForFix, 8),
    compiledExceptions: compileExceptionPatterns(ruleConfig.exceptionPatterns),
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

/** True when a line is natively non-prose (links/images/HTML only) or matches a user exception. */
function isNonProseOrException(line, filePath, compiledExceptions) {
  return isNonProseLine(stripInlineCode(String(line ?? "")))
    || lineMatchesException(line, filePath, compiledExceptions);
}

function shouldSkipCrossLinePair(lines, current, next, ruleCfg) {
  const { abbreviations, compiledExceptions, filePath } = ruleCfg;
  const ln = current.lineNumber;
  return isHtmlCommentLine(current.line)
    || isHtmlCommentLine(next.line)
    || getLineEndingState(current.line, { abbreviations }) === "ended"
    || lineMatchesException(current.line, filePath, compiledExceptions)
    || isNewListItem(next.line)
    || isNonProseOrException(next.line, filePath, compiledExceptions)
    || isRuleSuppressedByComment(lines, ln, "one-sentence-per-line")
    || isSubCheckSuppressedByComment(lines, ln, "one-sentence-per-line", "check_cross_line");
}

/**
 * Collect the downstream wrap chain starting at block index `i` (the open
 * line). Returns the array of subsequent line strings (from i+1 through the
 * first line that closes the sentence, inclusive) that together form the
 * wrapped sentence. Stops before a line that is non-prose or matches a
 * user-configured exception.
 */
function collectChainLines(block, i, ruleCfg, lines) {
  const { abbreviations, compiledExceptions, filePath } = ruleCfg;
  const chain = [];
  for (let k = i + 1; k < block.length; k++) {
    const entry = block[k];
    const ln = entry.lineNumber;
    if (isHtmlCommentLine(entry.line)
      || isNonProseOrException(entry.line, filePath, compiledExceptions)) break;
    chain.push(entry.line);
    if (getLineEndingState(entry.line, { abbreviations }) === "ended") break;
    if (k + 1 >= block.length) break;
    if (isNewListItem(block[k + 1].line)
      || isRuleSuppressedByComment(lines, ln, "one-sentence-per-line")
      || isSubCheckSuppressedByComment(lines, ln, "one-sentence-per-line", "check_cross_line")) break;
  }
  return chain;
}

function emitCrossLineWrap(wrap, onError, withFix) {
  const { current, next, chain } = wrap;
  const primary = { lineNumber: current.lineNumber, context: current.line,
    detail: "Sentence continues on next line; keep one sentence per physical line." };
  if (!withFix) { onError(primary); return; }
  const join = buildJoinFixInfo(current.line, chain);
  primary.fixInfo = join.primary;
  onError(primary);
  onError({ lineNumber: next.lineNumber, context: next.line, fixInfo: join.cleanup,
    detail: "Wrapped sentence continuation; --fix joins this line with the previous line." });
}

function scanCrossLine(params, onError, ruleCfg) {
  const lines = params.lines;
  const scanCfg = { ...ruleCfg, filePath: params.name || "" };
  for (const block of iterateProseBlocks(lines)) {
    for (let i = 0; i + 1 < block.length; i++) {
      const current = block[i];
      const next = block[i + 1];
      if (shouldSkipCrossLinePair(lines, current, next, scanCfg)) continue;
      const chain = collectChainLines(block, i, scanCfg, lines);
      // Fix-safety guard: scope `maxBlockLinesForFix` to this single fix's
      // footprint (open line + chain lines joined into one). Prose blocks
      // like bullet lists can stack many independent 2-line wraps, so a
      // block-level cap incorrectly suppressed every fix in the block.
      const fixLineCount = chain.length + 1;
      const withinFixSize = fixLineCount <= ruleCfg.maxBlockLinesForFix;
      emitCrossLineWrap({ current, next, chain }, onError, withinFixSize);
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
  formatLineAsOneSentencePerLine,
};
