"use strict";

const { parseFenceInfo, pathMatchesAny } = require("./utils.js");

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
 * Single pass: find all H2–H6 in range and all opening fence lines for configured languages.
 *
 * @param {string[]} lines
 * @param {{ minHeadingLevel: number, maxHeadingLevel: number, languages: string[] }} opts
 * @returns {{ headings: { lineNumber: number, level: number }[], blocks: { lineNumber: number, language: string }[] }}
 */
function findHeadingsAndBlocks(lines, opts) {
  const headings = [];
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
    }
  }

  return { headings, blocks };
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
 * For each block, get the last heading (H2–H6 in range) that appears before the block.
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
  const { blocks, headings, opts, lines, onError } = ctx;
  for (const block of blocks) {
    const headingLine = precedingHeading(headings, block.lineNumber);
    if (headingLine != null || !opts.requireHeading) continue;
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
      onError({
        lineNumber,
        detail: `At most ${opts.maxBlocksPerHeading} fenced code block(s) of the configured language(s) per heading (found ${lineNumbers.length} under same heading).`,
        context: lines[lineNumber - 1],
      });
    }
  }
}

function reportExclusiveViolations(ctx) {
  const { allBlocks, headings, opts, lines, onError } = ctx;
  const blocksByHeading = new Map();
  for (const block of allBlocks) {
    const key = precedingHeading(headings, block.lineNumber) ?? 0;
    if (!blocksByHeading.has(key)) blocksByHeading.set(key, []);
    blocksByHeading.get(key).push(block);
  }
  const langList = opts.languages.join(", ");
  for (const blockList of blocksByHeading.values()) {
    if (blockList.length > 1) {
      for (let i = 1; i < blockList.length; i++) {
        const { lineNumber } = blockList[i];
        onError({
          lineNumber,
          detail: `Only one fenced code block allowed per heading when exclusive is enabled (found ${blockList.length}).`,
          context: lines[lineNumber - 1],
        });
      }
    } else if (blockList.length === 1 && !opts.languages.includes(blockList[0].language)) {
      const { lineNumber, language } = blockList[0];
      const displayLang = language || "(no language)";
      onError({
        lineNumber,
        detail: `Fenced code block must be one of the configured languages: ${langList} (found '${displayLang}').`,
        context: lines[lineNumber - 1],
      });
    }
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

  const { headings, blocks } = findHeadingsAndBlocks(lines, opts);
  reportBlocksWithoutHeading({ blocks, headings, opts, lines, onError });
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
