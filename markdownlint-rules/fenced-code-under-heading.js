"use strict";

const { isRuleSuppressedByComment, parseFenceInfo, pathMatchesAny } = require("./utils.js");

const DEFAULT_MIN_HEADING_LEVEL = 2;
const DEFAULT_MAX_HEADING_LEVEL = 6;
const DEFAULT_MAX_BLOCKS_PER_HEADING = 1;

/**
 * Normalize config: languages (required), minHeadingLevel, maxHeadingLevel,
 * maxBlocksPerHeading, requireHeading, exclusive, excludePaths/includePaths.
 *
 * @param {object} raw - Raw config (rule's block)
 * @returns {object} Normalized options
 */
function normalizeConfig(raw) {
  const languages = Array.isArray(raw.languages) && raw.languages.length > 0
    ? raw.languages.map((l) => String(l).toLowerCase().trim()).filter(Boolean)
    : [];
  const minHeadingLevel =
    typeof raw.minHeadingLevel === "number" ? raw.minHeadingLevel : DEFAULT_MIN_HEADING_LEVEL;
  const maxHeadingLevel =
    typeof raw.maxHeadingLevel === "number" ? raw.maxHeadingLevel : DEFAULT_MAX_HEADING_LEVEL;
  const maxBlocksPerHeading = typeof raw.maxBlocksPerHeading === "number" ? raw.maxBlocksPerHeading : DEFAULT_MAX_BLOCKS_PER_HEADING;
  const requireHeading = raw.requireHeading !== false;
  const exclusive = raw.exclusive === true;
  return {
    languages,
    minHeadingLevel,
    maxHeadingLevel,
    maxBlocksPerHeading,
    requireHeading,
    exclusive,
    excludePaths: raw.excludePaths || raw.excludePathPatterns,
    includePaths: raw.includePaths || raw.includePathPatterns,
  };
}

const RE_ATX = /^(#{1,6})\s+/;

function processFenceLine(args) {
  const { trimmed, line, lineNumber, languages, state, blocks } = args;
  const fenceMatch = trimmed.match(/^(```+|~~~+)/);
  if (!fenceMatch) return false;
  const fenceStr = fenceMatch[1];
  const char = fenceStr[0];
  const marker = char === "`" ? "```" : "~~~";
  const len = fenceStr.length;
  if (!state.inFence) {
    state.inFence = true;
    state.fenceMarker = marker;
    state.fenceLen = len;
    const blockType = parseFenceInfo(line);
    if (languages.includes(blockType)) {
      blocks.push({ lineNumber, language: blockType });
    }
  } else if (state.fenceMarker === marker && len >= state.fenceLen) {
    state.inFence = false;
    state.fenceMarker = null;
    state.fenceLen = 0;
  }
  return true;
}

function processAtxLine(trimmed, lineNumber, opts, headings) {
  const m = trimmed.match(RE_ATX);
  if (!m) return;
  const level = m[1].length;
  if (level >= opts.minHeadingLevel && level <= opts.maxHeadingLevel) {
    headings.push({ lineNumber, level });
  }
}

/**
 * Single pass: find all headings in range, all ATX headings (any level), and opening fence lines.
 *
 * @param {string[]} lines
 * @param {{ minHeadingLevel: number, maxHeadingLevel: number, languages: string[] }} opts
 * @returns {{ headings: { lineNumber: number, level: number }[], allHeadings: { lineNumber: number, level: number }[], blocks: { lineNumber: number, language: string }[] }}
 */
function findHeadingsAndBlocks(lines, opts) {
  const headings = [];
  const allHeadings = [];
  const blocks = [];
  const state = { inFence: false, fenceMarker: null, fenceLen: 0 };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    if (processFenceLine({ trimmed, line, lineNumber, languages: opts.languages, state, blocks })) {
      continue;
    }
    if (!state.inFence) {
      processAtxLine(trimmed, lineNumber, opts, headings);
      const m = trimmed.match(RE_ATX);
      if (m) allHeadings.push({ lineNumber, level: m[1].length });
    }
  }

  return { headings, allHeadings, blocks };
}

/**
 * Find all fenced code blocks (any language) with line number and language.
 * Used when exclusive is true to enforce only one block per heading.
 *
 * @param {string[]} lines
 * @returns {{ lineNumber: number, language: string }[]}
 */
function findAllBlocks(lines) {
  const blocks = [];
  const state = { inFence: false, fenceMarker: null, fenceLen: 0 };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (!fenceMatch) continue;
    const fenceStr = fenceMatch[1];
    const char = fenceStr[0];
    const marker = char === "`" ? "```" : "~~~";
    const len = fenceStr.length;
    if (!state.inFence) {
      state.inFence = true;
      state.fenceMarker = marker;
      state.fenceLen = len;
      const language = (parseFenceInfo(line) || "").toLowerCase().trim();
      blocks.push({ lineNumber, language });
    } else if (state.fenceMarker === marker && len >= state.fenceLen) {
      state.inFence = false;
      state.fenceMarker = null;
      state.fenceLen = 0;
    }
  }

  return blocks;
}

/**
 * For each block, get the last heading (in range) that appears before the block.
 *
 * @param {{ lineNumber: number, level: number }[]} headings - Sorted by lineNumber
 * @param {number} blockLine
 * @returns {number|null} Line number of preceding heading or null
 */
function precedingHeading(headings, blockLine) {
  let last = null;
  for (const h of headings) {
    if (h.lineNumber >= blockLine) break;
    last = h.lineNumber;
  }
  return last;
}

/**
 * Get the immediately preceding heading (any level) before blockLine.
 *
 * @param {{ lineNumber: number, level: number }[]} allHeadings - Sorted by lineNumber
 * @param {number} blockLine
 * @returns {{ lineNumber: number, level: number }|null}
 */
function precedingHeadingAnyLevel(allHeadings, blockLine) {
  let last = null;
  for (const h of allHeadings) {
    if (h.lineNumber >= blockLine) break;
    last = h;
  }
  return last;
}

/* c8 ignore start -- path filter branches covered by tests; per-file threshold met by other code */
function shouldSkipFile(filePath, opts) {
  const includePaths = Array.isArray(opts.includePaths) ? opts.includePaths : [];
  const excludePaths = Array.isArray(opts.excludePaths) ? opts.excludePaths : [];
  if (includePaths.length > 0 && !pathMatchesAny(filePath, includePaths)) return true;
  if (pathMatchesAny(filePath, excludePaths)) return true;
  return false;
}
/* c8 ignore stop */

function reportBlocksWithoutHeading(ctx) {
  const { blocks, allHeadings, opts, lines, onError } = ctx;
  for (const block of blocks) {
    const immediate = precedingHeadingAnyLevel(allHeadings, block.lineNumber);
    if (!opts.requireHeading) continue;
    const validLevel = immediate != null && immediate.level >= opts.minHeadingLevel && immediate.level <= opts.maxHeadingLevel;
    if (validLevel) continue;
    if (isRuleSuppressedByComment(lines, block.lineNumber, "fenced-code-under-heading")) continue;
    onError({
      lineNumber: block.lineNumber,
      detail: `Fenced code block (${block.language}) must have an H${opts.minHeadingLevel}-H${opts.maxHeadingLevel} heading above it.`,
      context: lines[block.lineNumber - 1],
    });
  }
}

function reportExcessBlocksPerHeading(ctx) {
  const { blocks, headings, opts, lines, onError } = ctx;
  const blocksByHeading = new Map();
  for (const block of blocks) {
    const key = precedingHeading(headings, block.lineNumber) ?? 0;
    if (!blocksByHeading.has(key)) blocksByHeading.set(key, []);
    blocksByHeading.get(key).push(block.lineNumber);
  }
  for (const lineNumbers of blocksByHeading.values()) {
    for (let i = opts.maxBlocksPerHeading; i < lineNumbers.length; i++) {
      const lineNumber = lineNumbers[i];
      if (isRuleSuppressedByComment(lines, lineNumber, "fenced-code-under-heading")) continue;
      onError({
        lineNumber,
        detail: `At most ${opts.maxBlocksPerHeading} fenced code block(s) of the configured language(s) per heading (found ${lineNumbers.length} under same heading).`,
        context: lines[lineNumber - 1],
      });
    }
  }
}

function reportExclusiveBlockErrors(blockList, ctx) {
  const { opts, lines, onError } = ctx;
  const langList = opts.languages.join(", ");
  if (blockList.length > 1) {
    for (let i = 1; i < blockList.length; i++) {
      const { lineNumber } = blockList[i];
      if (isRuleSuppressedByComment(lines, lineNumber, "fenced-code-under-heading")) continue;
      onError({
        lineNumber,
        detail: `Only one fenced code block allowed per heading when exclusive is enabled (found ${blockList.length}).`,
        context: lines[lineNumber - 1],
      });
    }
    return;
  }
  if (blockList.length === 1 && !opts.languages.includes(blockList[0].language)) {
    const { lineNumber, language } = blockList[0];
    if (!isRuleSuppressedByComment(lines, lineNumber, "fenced-code-under-heading")) {
      const displayLang = language || "(no language)";
      onError({
        lineNumber,
        detail: `Fenced code block must be one of the configured languages: ${langList} (found '${displayLang}').`,
        context: lines[lineNumber - 1],
      });
    }
  }
}

function reportExclusiveViolations(ctx) {
  const { allBlocks, headings, lines, onError, opts } = ctx;
  const blocksByHeading = new Map();
  for (const block of allBlocks) {
    const key = precedingHeading(headings, block.lineNumber) ?? 0;
    if (!blocksByHeading.has(key)) blocksByHeading.set(key, []);
    blocksByHeading.get(key).push(block);
  }
  const reportCtx = { opts, lines, onError };
  for (const blockList of blocksByHeading.values()) {
    reportExclusiveBlockErrors(blockList, reportCtx);
  }
}

/**
 * markdownlint rule: fenced code blocks with specified language(s) must have an H2–H6 heading
 * above them; at most N blocks per heading (configurable).
 *
 * @param {object} params - markdownlint params (lines, config, name)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const filePath = params.name || "";
  const raw = params.config?.["fenced-code-under-heading"] ?? params.config ?? {};
  const opts = normalizeConfig(raw);

  /* c8 ignore start -- early exit: languages empty or path skip */
  if (opts.languages.length === 0 || shouldSkipFile(filePath, opts)) return;
  /* c8 ignore stop */

  const { headings, allHeadings, blocks } = findHeadingsAndBlocks(lines, opts);
  reportBlocksWithoutHeading({ blocks, allHeadings, opts, lines, onError });
  if (opts.exclusive) {
    const allBlocks = findAllBlocks(lines);
    reportExclusiveViolations({ allBlocks, headings, opts, lines, onError });
  } else {
    reportExcessBlocksPerHeading({ blocks, headings, opts, lines, onError });
  }
}

module.exports = {
  names: ["fenced-code-under-heading"],
  description:
    "Fenced code blocks with specified language(s) must have an H2–H6 heading above them; at most N blocks per heading; optional exclusive (one block total per heading).",
  tags: ["code"],
  function: ruleFunction,
};
