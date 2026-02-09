"use strict";

const {
  extractHeadings,
  parseHeadingNumberPrefix,
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
 * Section-scoped: only used when at least one sibling has numbering.
 * 0-based when the first numbered sibling's last segment is "0" (e.g. "0", "0.0", "1.0").
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
  /* c8 ignore start -- sectionUsesNum ensures at least one numbered sibling */
  const firstNumbering =
    firstNumbered != null
      ? parseHeadingNumberPrefix(firstNumbered.rawText).numbering
      : null;
  /* c8 ignore stop */
  const lastSegment = firstNumbering.split(".").pop();
  const startAtZero = lastSegment === "0";
  const nextNum = startAtZero ? myIdx : myIdx + 1;
  const prefix = parentNum ? parentNum + "." : "";
  return prefix + String(nextNum);
}

/**
 * Whether any sibling in the section (same parent) has numbering.
 */
function sectionUsesNumbering(sorted, parentIndex, i) {
  const siblings = getSiblings(sorted, parentIndex, i);
  return siblings.some(
    (s) => parseHeadingNumberPrefix(s.rawText).numbering != null
  );
}

/**
 * First period style (hasH2Dot) among numbered siblings in this section; null if none numbered.
 */
function getSectionPeriodStyle(sorted, parentIndex, i) {
  const siblings = getSiblings(sorted, parentIndex, i);
  const firstNumbered = siblings.find((s) =>
    parseHeadingNumberPrefix(s.rawText).numbering != null
  );
  /* c8 ignore start -- getPeriodStyleError only called for numbered headings */
  if (firstNumbered == null) {
    return null;
  }
  /* c8 ignore stop */
  return parseHeadingNumberPrefix(firstNumbered.rawText).hasH2Dot;
}

/**
 * Check period style consistency with numbered siblings in the same section.
 * @param {object} ctx - { h, sorted, parentIndex, i, contextLine }
 * @returns {object|null} Error object or null
 */
function getPeriodStyleError(ctx) {
  const { h, sorted, parentIndex, i, contextLine } = ctx;
  const { hasH2Dot } = parseHeadingNumberPrefix(h.rawText);
  const sectionPeriodStyle = getSectionPeriodStyle(sorted, parentIndex, i);
  if (sectionPeriodStyle == null || hasH2Dot === sectionPeriodStyle) return null;
  return {
    lineNumber: h.lineNumber,
    detail: `Numbering period style inconsistent: use ${sectionPeriodStyle ? "a period" : "no period"} after the number (e.g. "${sectionPeriodStyle ? "1.2." : "1.2"}") to match other numbered headings in this section.`,
    context: contextLine,
  };
}

/**
 * Check that numbered heading has correct segment count (level - numbering root level).
 * @param {object} ctx - { h, sorted, parentIndex, i, contextLine }
 * @returns {object|null} Error object or null
 */
function checkSegmentCount(ctx) {
  const { h, sorted, parentIndex, i, contextLine } = ctx;
  const { numbering } = parseHeadingNumberPrefix(h.rawText);
  if (numbering == null) return null;
  const rootLevel = getNumberingRootLevel(sorted, parentIndex, i);
  const expectedSegmentCount = h.level - rootLevel;
  const segments = numbering.split(".");
  if (segments.length !== expectedSegmentCount) {
    return { lineNumber: h.lineNumber, detail: `H${h.level} heading has ${segments.length} segment(s) in number prefix "${numbering}"; expected ${expectedSegmentCount} (one per level from numbering root).`, context: contextLine };
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
  const num = parseHeadingNumberPrefix(h.rawText).numbering;
  if (expected != null && num !== expected) {
    errors.push({ lineNumber: h.lineNumber, detail: `Number prefix "${num}" is out of sequence in this section; expected "${expected}" to match sibling order.`, context: contextLine });
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
    errors.push({ lineNumber: h.lineNumber, detail: "This heading has no number prefix but other headings in this section are numbered; add a number prefix to match siblings (e.g. \"1.2\" for second under 1).", context: contextLine });
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

/**
 * markdownlint rule: validate numbered headings (segment count, sequence per section, period style).
 * Optional: maxHeadingLevel (disallow deeper headings), maxSegmentValue (cap segment value, with level range).
 *
 * @param {object} params - markdownlint params (lines, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const lines = params.lines;
  const headings = extractHeadings(lines);
  const opts = getNumberingOpts(params.config || {});

  const withNumbering = headings
    .map((h) => ({
      ...h,
      parsed: parseHeadingNumberPrefix(h.rawText),
    }))
    .filter((h) => h.parsed.numbering != null);

  const hasMaxHeadingLevel = typeof opts.maxHeadingLevel === "number";
  if (withNumbering.length === 0 && !hasMaxHeadingLevel) {
    return;
  }

  const { sorted, parentIndex } = buildParentIndex(headings);

  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i];
    const contextLine = lines[h.lineNumber - 1];
    for (const err of getHeadingErrors(h, i, { sorted, parentIndex, contextLine, opts })) {
      onError(err);
    }
  }
}

module.exports = {
  names: ["heading-numbering"],
  description:
    "Numbered headings: segment count by numbering root; numbering consistent within each section; period style consistent within section.",
  tags: ["headings"],
  function: ruleFunction,
};
