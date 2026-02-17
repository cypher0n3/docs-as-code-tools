"use strict";

const {
  extractHeadings,
  getNumberPrefixSpan,
  insertTextForExpectedNumber,
  isRuleSuppressedByComment,
  parseHeadingNumberPrefix,
  pathMatchesAny,
} = require("./utils.js");

/**
 * Build parent index for each heading (0-based index of parent in sorted list).
 * Siblings are same-level headings under the same parent; parent is previous heading with level one less.
 */
function buildParentIndex(headings) {
  const sorted = headings.slice().sort((a, b) => a.lineNumber - b.lineNumber);
  const parentIndex = [];
  const stack = [];

  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i];
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1].index : null;
    parentIndex[i] = parent;
    stack.push({ level: h.level, index: i });
  }

  return { sorted, parentIndex };
}

/**
 * Level of the "numbering root" for heading at index i: the nearest ancestor that has no numbering (or 1 at doc root).
 * Segment count for a numbered heading = heading.level - numberingRootLevel.
 */
function getNumberingRootLevel(sorted, parentIndex, i) {
  const parentIdx = parentIndex[i];
  if (parentIdx == null) {
    return 1;
  }
  const parentNum = parseHeadingNumberPrefix(sorted[parentIdx].rawText).numbering;
  if (parentNum == null) {
    return sorted[parentIdx].level;
  }
  return getNumberingRootLevel(sorted, parentIndex, parentIdx);
}

/**
 * Get siblings of heading at index i (same parent, same level), sorted by line.
 */
function getSiblings(sorted, parentIndex, i) {
  const h = sorted[i];
  const siblings = [];
  for (let j = 0; j < sorted.length; j++) {
    if (parentIndex[j] !== parentIndex[i]) {
      continue;
    }
    /* c8 ignore start -- same parent implies same level by tree construction */
    if (sorted[j].level !== h.level) {
      continue;
    }
    /* c8 ignore stop */
    siblings.push({ index: j, ...sorted[j] });
  }
  siblings.sort((a, b) => a.lineNumber - b.lineNumber);
  return siblings;
}

/**
 * Expected number for heading at index i within its section (parent prefix + sibling sequence).
 * Used when section uses numbering (parent has numbering or at least one sibling has numbering).
 * 0-based when the first numbered sibling's last segment is "0" (e.g. "0", "0.0", "1.0").
 * When no sibling has numbering but parent does, returns parent prefix + "1" (first child).
 */
function getExpectedNumberInSection(sorted, parentIndex, i) {
  const h = sorted[i];
  const parentIdx = parentIndex[i];
  const parent = parentIdx != null ? sorted[parentIdx] : null;
  const parentNum =
    parent != null ? parseHeadingNumberPrefix(parent.rawText).numbering : null;

  const siblings = getSiblings(sorted, parentIndex, i);
  const myIdx = siblings.findIndex((s) => s.lineNumber === h.lineNumber);
  /* c8 ignore start -- current heading is always in its sibling list */
  if (myIdx < 0) {
    return null;
  }
  /* c8 ignore stop */

  const firstNumbered = siblings.find((s) =>
    parseHeadingNumberPrefix(s.rawText).numbering != null
  );
  const firstNumbering =
    firstNumbered != null
      ? parseHeadingNumberPrefix(firstNumbered.rawText).numbering
      : null;

  let nextNum;
  if (firstNumbering != null) {
    const lastSegment = firstNumbering.split(".").pop();
    const startAtZero = lastSegment === "0";
    nextNum = startAtZero ? myIdx : myIdx + 1;
  } else {
    nextNum = 1;
  }
  const prefix = parentNum ? parentNum + "." : "";
  return prefix + String(nextNum);
}

/**
 * Whether the section uses numbering: parent has numbering or any sibling (same parent, same level) has numbering.
 * When true, all headings in the section must have numbering (parent's children must be numbered).
 */
function sectionUsesNumbering(sorted, parentIndex, i) {
  const parentIdx = parentIndex[i];
  const parent = parentIdx != null ? sorted[parentIdx] : null;
  if (parent != null && parseHeadingNumberPrefix(parent.rawText).numbering != null) {
    return true;
  }
  const siblings = getSiblings(sorted, parentIndex, i);
  return siblings.some(
    (s) => parseHeadingNumberPrefix(s.rawText).numbering != null
  );
}

/**
 * First period style (hasH2Dot) among numbered siblings in this section; if none, use parent's style when parent has numbering; null otherwise.
 */
function getSectionPeriodStyle(sorted, parentIndex, i) {
  const siblings = getSiblings(sorted, parentIndex, i);
  const firstNumbered = siblings.find((s) =>
    parseHeadingNumberPrefix(s.rawText).numbering != null
  );
  if (firstNumbered != null) {
    return parseHeadingNumberPrefix(firstNumbered.rawText).hasH2Dot;
  }
  const parentIdx = parentIndex[i];
  const parent = parentIdx != null ? sorted[parentIdx] : null;
  if (parent == null) return null;
  const parentParsed = parseHeadingNumberPrefix(parent.rawText);
  return parentParsed.numbering != null ? parentParsed.hasH2Dot : null;
}

/**
 * Check period style consistency with numbered siblings in the same section.
 * @param {object} ctx - { h, sorted, parentIndex, i, contextLine }
 * @returns {object|null} Error object or null
 */
function getPeriodStyleError(ctx) {
  const { h, sorted, parentIndex, i, contextLine } = ctx;
  const { numbering, hasH2Dot } = parseHeadingNumberPrefix(h.rawText);
  const sectionPeriodStyle = getSectionPeriodStyle(sorted, parentIndex, i);
  if (sectionPeriodStyle == null || hasH2Dot === sectionPeriodStyle) return null;
  const insertText = numbering + (sectionPeriodStyle ? "." : "") + " ";
  const { editColumn, deleteCount } = getNumberPrefixSpan(h.level, h.rawText, numbering, hasH2Dot);
  return {
    lineNumber: h.lineNumber,
    detail: `Numbering period style inconsistent: use ${sectionPeriodStyle ? "a period" : "no period"} after the number (e.g. "${sectionPeriodStyle ? "1.2." : "1.2"}") to match other numbered headings in this section.`,
    context: contextLine,
    fixInfo: { editColumn, deleteCount, insertText },
  };
}

/**
 * Check that numbered heading has correct segment count (level - numbering root level).
 * @param {object} ctx - { h, sorted, parentIndex, i, contextLine }
 * @returns {object|null} Error object or null
 */
function checkSegmentCount(ctx) {
  const { h, sorted, parentIndex, i, contextLine } = ctx;
  const { numbering, hasH2Dot } = parseHeadingNumberPrefix(h.rawText);
  if (numbering == null) return null;
  const rootLevel = getNumberingRootLevel(sorted, parentIndex, i);
  const expectedSegmentCount = h.level - rootLevel;
  const segments = numbering.split(".");
  if (segments.length !== expectedSegmentCount) {
    const expected = getExpectedNumberInSection(sorted, parentIndex, i);
    const insertText = insertTextForExpectedNumber(expected, getSectionPeriodStyle(sorted, parentIndex, i));
    const { editColumn, deleteCount } = getNumberPrefixSpan(h.level, h.rawText, numbering, hasH2Dot);
    const fixInfo = insertText ? { editColumn, deleteCount, insertText } : undefined;
    return {
      lineNumber: h.lineNumber,
      detail: `H${h.level} heading has ${segments.length} segment(s) in number prefix "${numbering}"; expected ${expectedSegmentCount} (one per level from numbering root).`,
      context: contextLine,
      ...(fixInfo && { fixInfo }),
    };
  }
  return null;
}

function levelInSegmentValueScope(level, minL, maxL) {
  return level >= minL && level <= maxL;
}

/**
 * Check that no segment in numbering exceeds maxSegmentValue (when configured and level in scope).
 * @param {object} ctx - { h, contextLine, maxSegmentValue, maxSegmentValueMinLevel, maxSegmentValueMaxLevel }
 * @returns {object|null} Error object or null
 */
function checkMaxSegmentValue(ctx) {
  const { h, contextLine, maxSegmentValue, maxSegmentValueMinLevel, maxSegmentValueMaxLevel } = ctx;
  if (typeof maxSegmentValue !== "number" || maxSegmentValue < 0) return null;
  const minL = typeof maxSegmentValueMinLevel === "number" ? maxSegmentValueMinLevel : 1;
  const maxL = typeof maxSegmentValueMaxLevel === "number" ? maxSegmentValueMaxLevel : 6;
  if (!levelInSegmentValueScope(h.level, minL, maxL)) return null;
  const { numbering } = parseHeadingNumberPrefix(h.rawText);
  if (numbering == null) return null;
  const segments = numbering.split(".");
  const over = segments.find((seg) => {
    const n = parseInt(seg, 10);
    return !Number.isNaN(n) && n > maxSegmentValue;
  });
  if (!over) return null;
  return {
    lineNumber: h.lineNumber,
    detail: `Number segment "${over}" in prefix "${numbering}" exceeds maximum allowed value (${maxSegmentValue}).`,
    context: contextLine,
  };
}

function addMaxHeadingLevelError(h, opts, contextLine, errors) {
  if (typeof opts.maxHeadingLevel !== "number" || h.level <= opts.maxHeadingLevel) return;
  errors.push({
    lineNumber: h.lineNumber,
    detail: `Heading level H${h.level} is deeper than maximum allowed (${opts.maxHeadingLevel}); use at most H${opts.maxHeadingLevel}.`,
    context: contextLine,
  });
}

function addNumberingErrorsForNumberedHeading(h, i, ctx, errors) {
  const { sorted, parentIndex, contextLine, opts = {} } = ctx;
  const maxSegErr = checkMaxSegmentValue({
    h,
    contextLine,
    maxSegmentValue: opts.maxSegmentValue,
    maxSegmentValueMinLevel: opts.maxSegmentValueMinLevel,
    maxSegmentValueMaxLevel: opts.maxSegmentValueMaxLevel,
  });
  if (maxSegErr) errors.push(maxSegErr);

  const segmentErr = checkSegmentCount({ h, sorted, parentIndex, i, contextLine });
  if (segmentErr) {
    errors.push(segmentErr);
    return;
  }
  const periodErr = getPeriodStyleError({ h, sorted, parentIndex, i, contextLine });
  if (periodErr) errors.push(periodErr);
  const expected = getExpectedNumberInSection(sorted, parentIndex, i);
  const { numbering: num, hasH2Dot } = parseHeadingNumberPrefix(h.rawText);
  if (expected != null && num !== expected) {
    const insertText = insertTextForExpectedNumber(expected, getSectionPeriodStyle(sorted, parentIndex, i));
    const { editColumn, deleteCount } = getNumberPrefixSpan(h.level, h.rawText, num, hasH2Dot);
    errors.push({
      lineNumber: h.lineNumber,
      detail: `Number prefix "${num}" is out of sequence in this section; expected "${expected}" to match sibling order.`,
      context: contextLine,
      fixInfo: { editColumn, deleteCount, insertText },
    });
  }
}

/**
 * Return zero or more errors for heading at index i (numbering, segment count, sequence, period style, maxSegmentValue, maxHeadingLevel).
 * @param {object} h - Heading object { lineNumber, level, rawText }
 * @param {number} i - Index in sorted headings
 * @param {object} ctx - { sorted, parentIndex, contextLine, opts }
 * @returns {object[]} Array of error objects
 */
function getHeadingErrors(h, i, ctx) {
  const errors = [];
  const { sorted, parentIndex, contextLine, opts = {} } = ctx;
  const { numbering } = parseHeadingNumberPrefix(h.rawText);

  addMaxHeadingLevelError(h, opts, contextLine, errors);

  const sectionUsesNum = sectionUsesNumbering(sorted, parentIndex, i);
  if (sectionUsesNum && numbering == null) {
    const expected = getExpectedNumberInSection(sorted, parentIndex, i);
    const insertText = insertTextForExpectedNumber(expected, getSectionPeriodStyle(sorted, parentIndex, i));
    const { editColumn, deleteCount } = getNumberPrefixSpan(h.level, h.rawText, null, false);
    const fixInfo = insertText ? { editColumn, deleteCount, insertText } : undefined;
    errors.push({
      lineNumber: h.lineNumber,
      detail: "This heading has no number prefix but this section uses numbering (parent or siblings); add a number prefix to match (e.g. \"1.2\" for second under 1, \"1.2.1\" for first child under 1.2).",
      context: contextLine,
      ...(fixInfo && { fixInfo }),
    });
    return errors;
  }
  if (numbering == null) return errors;

  addNumberingErrorsForNumberedHeading(h, i, ctx, errors);
  return errors;
}

function readMaxHeadingLevel(block) {
  const v = block.maxHeadingLevel;
  return typeof v === "number" && v >= 1 && v <= 6 ? v : undefined;
}

function readMaxSegmentValueOpts(block) {
  const v = block.maxSegmentValue;
  if (typeof v !== "number" || v < 0) return undefined;
  return {
    maxSegmentValue: v,
    maxSegmentValueMinLevel: typeof block.maxSegmentValueMinLevel === "number" ? block.maxSegmentValueMinLevel : 1,
    maxSegmentValueMaxLevel: typeof block.maxSegmentValueMaxLevel === "number" ? block.maxSegmentValueMaxLevel : 6,
  };
}

/**
 * Get the expected number prefix for a new heading inserted at the given line and level.
 * Uses the same section/sibling logic as the rule. Returns "" if the section does not use numbering.
 *
 * @param {string[]} lines - Document lines
 * @param {number} insertAtLineNumber - 1-based line number where the new heading would be inserted
 * @param {number} level - Heading level (1-6) of the new heading
 * @returns {string} Prefix string (e.g. "1.2 " or "1.2. ") or ""
 */
function getExpectedPrefixForNewHeading(lines, insertAtLineNumber, level) {
  const headings = extractHeadings(lines);
  headings.push({ lineNumber: insertAtLineNumber, level, rawText: "" });
  const { sorted, parentIndex } = buildParentIndex(headings);
  const synIndex = sorted.findIndex(
    (h) => h.lineNumber === insertAtLineNumber && h.rawText === ""
  );
  if (synIndex < 0) return "";
  if (!sectionUsesNumbering(sorted, parentIndex, synIndex)) return "";
  const expected = getExpectedNumberInSection(sorted, parentIndex, synIndex);
  const usePeriod = getSectionPeriodStyle(sorted, parentIndex, synIndex);
  return insertTextForExpectedNumber(expected, usePeriod);
}

/**
 * Normalize optional config for heading-numbering extensions: maxHeadingLevel, maxSegmentValue, level range for maxSegmentValue.
 *
 * @param {object} raw - Full config (params.config)
 * @returns {object} opts for getHeadingErrors
 */
function getNumberingOpts(raw) {
  const block = raw?.["heading-numbering"] ?? raw ?? {};
  const opts = {};
  const segOpts = readMaxSegmentValueOpts(block);
  if (segOpts) Object.assign(opts, segOpts);
  const mhl = readMaxHeadingLevel(block);
  if (mhl !== undefined) opts.maxHeadingLevel = mhl;
  return opts;
}

function shouldSkipByPath(filePath, block) {
  const excludePatterns = block.excludePathPatterns;
  return Array.isArray(excludePatterns) && excludePatterns.length > 0 && pathMatchesAny(filePath, excludePatterns);
}

function getWithNumbering(headings) {
  return headings
    .map((h) => ({ ...h, parsed: parseHeadingNumberPrefix(h.rawText) }))
    .filter((h) => h.parsed.numbering != null);
}

function reportErrorsForHeading(h, index, ctx, onError) {
  const contextLine = ctx.lines[h.lineNumber - 1];
  for (const err of getHeadingErrors(h, index, {
    sorted: ctx.sorted,
    parentIndex: ctx.parentIndex,
    contextLine,
    opts: ctx.opts,
  })) {
    if (isRuleSuppressedByComment(ctx.lines, err.lineNumber, "heading-numbering")) continue;
    onError(err);
  }
}

/**
 * markdownlint rule: validate numbered headings (segment count, sequence per section, period style).
 * Optional: maxHeadingLevel (disallow deeper headings), maxSegmentValue (cap segment value, with level range).
 *
 * @param {object} params - markdownlint params (lines, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const filePath = params.name || "";
  const block = params.config?.["heading-numbering"] ?? params.config ?? {};
  if (shouldSkipByPath(filePath, block)) return;

  const lines = params.lines;
  const headings = extractHeadings(lines);
  const opts = getNumberingOpts(params.config || {});
  const withNumbering = getWithNumbering(headings);
  if (withNumbering.length === 0 && typeof opts.maxHeadingLevel !== "number") return;

  const { sorted, parentIndex } = buildParentIndex(headings);
  const ctx = { lines, sorted, parentIndex, opts };
  for (let i = 0; i < sorted.length; i++) {
    reportErrorsForHeading(sorted[i], i, ctx, onError);
  }
}

module.exports = {
  names: ["heading-numbering"],
  description:
    "Numbered headings: segment count by numbering root; numbering consistent within each section; period style consistent within section.",
  tags: ["headings"],
  function: ruleFunction,
  getExpectedPrefixForNewHeading,
};
