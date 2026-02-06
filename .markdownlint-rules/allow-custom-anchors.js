"use strict";

const { stripInlineCode } = require("./utils.js");

function safeRegExp(str) {
  if (typeof str !== "string" || !str) return null;
  try {
    return new RegExp(str);
  } catch {
    return null;
  }
}

function parsePlacement(placement, patternIndex) {
  if (!placement || typeof placement !== "object") return null;
  const requireAfter = Array.isArray(placement.requireAfter)
    ? placement.requireAfter.filter((x) => ["blank", "fencedBlock", "list"].includes(x))
    : [];
  const maxPerSection =
    typeof placement.maxPerSection === "number" && placement.maxPerSection >= 1
      ? placement.maxPerSection
      : null;
  return {
    patternIndex,
    headingMatch: safeRegExp(placement.headingMatch),
    lineMatch: safeRegExp(placement.lineMatch),
    standaloneLine: placement.standaloneLine === true,
    requireAfter,
    anchorImmediatelyAfterHeading: placement.anchorImmediatelyAfterHeading === true,
    maxPerSection,
  };
}

function parseOneEntry(item, i) {
  let patternStr = null;
  let placementRaw = null;
  if (typeof item === "string" && item.length > 0) {
    patternStr = item;
  } else if (item && typeof item === "object" && typeof item.pattern === "string" && item.pattern.length > 0) {
    patternStr = item.pattern;
    placementRaw = item.placement;
  }
  if (!patternStr) return null;
  const pattern = safeRegExp(patternStr);
  if (!pattern) return null;
  return { pattern, placement: parsePlacement(placementRaw, i) };
}

function getConfig(params) {
  const c = params.config || {};
  const raw = Array.isArray(c.allowedIdPatterns) ? c.allowedIdPatterns : [];
  const allowedEntries = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = parseOneEntry(raw[i], i);
    if (entry) allowedEntries.push(entry);
  }
  return {
    allowedEntries,
    strictPlacement: c.strictPlacement !== false,
  };
}

function checkPlacementLineMatch(opts) {
  const { line, rule, lineNumber, context } = opts;
  if (!rule.lineMatch) return null;
  const anchorPos = line.lastIndexOf("<a");
  const before = (anchorPos >= 0 ? line.slice(0, anchorPos) : line).trim();
  if (rule.lineMatch.test(before)) return null;
  return { lineNumber, detail: "[lineMatch] Anchor line must match the configured lineMatch pattern for this id.", context };
}

function checkPlacementStandalone(opts) {
  const { trimmed, id, rule, lineNumber, context } = opts;
  if (!rule.standaloneLine || trimmed === `<a id="${id}"></a>`) return null;
  return { lineNumber, detail: "[standaloneLine] This anchor must be on its own line (no other content).", context };
}

function checkPlacementHeadingSection(opts) {
  const { matchIndex, rule, sectionStack, sectionAnchorCount, lineNumber, context } = opts;
  if (!rule.headingMatch) return null;
  const inSection = sectionStack.some((s) => s.patternIndex === matchIndex);
  if (!inSection) return { lineNumber, detail: "[headingMatch] This anchor must appear within a section whose heading matches the configured headingMatch.", context };
  if (rule.maxPerSection == null) return null;
  const count = sectionAnchorCount.get(matchIndex) || 0;
  if (count >= rule.maxPerSection) {
    return { lineNumber, detail: `[maxPerSection] Only ${rule.maxPerSection} anchor(s) of this type allowed per section.`, context };
  }
  sectionAnchorCount.set(matchIndex, count + 1);
  return null;
}

function checkPlacementImmediatelyAfter(opts) {
  const { index, rule, lines, lineNumber, context } = opts;
  if (!rule.anchorImmediatelyAfterHeading) return null;
  let prev = index - 1;
  while (prev >= 0 && lines[prev].trim() === "") prev--;
  const prevLine = prev >= 0 ? lines[prev].trim() : "";
  const matches = rule.headingMatch ? rule.headingMatch.test(prevLine) : /^\s*#{1,6}\s+/.test(prevLine);
  if (prev >= 0 && matches) return null;
  return { lineNumber, detail: "[anchorImmediatelyAfterHeading] This anchor must appear immediately after the section heading (blank lines allowed).", context };
}

function checkRequireAfterBlank(next, lineNumber, context) {
  if (next == null || next.trim() !== "") {
    return { lineNumber, detail: "[requireAfter] Anchor line must be followed by a blank line.", context };
  }
  return null;
}

function checkRequireAfterFenced(checkLine, lineNumber, context) {
  if (checkLine == null || !checkLine.trim().match(/^(```+|~~~+)/)) {
    return { lineNumber, context, detail: "[requireAfter] Anchor line must be followed by a blank line and then a fenced code block." };
  }
  return null;
}

function checkRequireAfterList(checkLine, lineNumber, context) {
  if (checkLine == null || !/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(checkLine.trim())) {
    return { lineNumber, context, detail: "[requireAfter] Anchor line must be followed by a blank line and then a list (ordered or unordered)." };
  }
  return null;
}

function checkPlacementRequireAfter(opts) {
  const { index, rule, lines, lineNumber, context } = opts;
  if (rule.requireAfter.length === 0) return null;
  const next = lines[index + 1];
  const next2 = lines[index + 2];
  const needBlank = rule.requireAfter[0] === "blank";
  const checkLine = needBlank ? next2 : next;
  const errBlank = needBlank ? checkRequireAfterBlank(next, lineNumber, context) : null;
  if (errBlank) return errBlank;
  if (rule.requireAfter.includes("fencedBlock")) {
    const err = checkRequireAfterFenced(checkLine, lineNumber, context);
    if (err) return err;
  }
  if (rule.requireAfter.includes("list")) {
    const err = checkRequireAfterList(checkLine, lineNumber, context);
    if (err) return err;
  }
  return null;
}

function getPlacementError(opts) {
  const { rule, lineNumber, line } = opts;
  if (!rule) return null;
  const base = { lineNumber, context: line };
  return checkPlacementLineMatch({ ...opts, ...base })
    || checkPlacementStandalone({ ...opts, ...base })
    || checkPlacementHeadingSection({ ...opts, ...base })
    || checkPlacementImmediatelyAfter({ ...opts, ...base })
    || checkPlacementRequireAfter({ ...opts, context: line });
}

const ANCHOR_TAG_RE = /<a id="([^"]+)"><\/a>/;
const ANCHOR_END_RE = /<a id="([^"]+)"><\/a>\s*$/;

/** Returns first format/allowance error for this line, or null. */
function getBasicAnchorError(scanLine, line, lineNumber, allowedPatterns) {
  if (scanLine.indexOf("<a", scanLine.indexOf("<a") + 1) !== -1) {
    return { lineNumber, detail: "[one-per-line] Only one <a id=\"...\"></a> anchor is allowed per line.", context: line };
  }
  const match = scanLine.match(ANCHOR_TAG_RE);
  if (!match) return { lineNumber, detail: "[anchor-format] Only <a id=\"...\"></a> anchors are allowed, with id as the only attribute.", context: line };
  if (!allowedPatterns.some((re) => re.test(match[1]))) {
    return { lineNumber, detail: "[allowedIdPatterns] Anchor id must match one of the configured allowedIdPatterns.", context: line };
  }
  if (!scanLine.match(ANCHOR_END_RE)) {
    return { lineNumber, detail: "[end-of-line] Anchors must appear at the end of the line (or be a standalone reference anchor line above a fenced code block).", context: line };
  }
  return null;
}

function updateFenceState(trimmed, inFence, fenceMarker) {
  const fenceMatch = trimmed.match(/^(```+|~~~+)/);
  if (!fenceMatch) return { inFence, fenceMarker, isFenceLine: false };
  const marker = fenceMatch[1][0] === "`" ? "```" : "~~~";
  const nextInFence = !inFence || fenceMarker !== marker;
  const nextMarker = !inFence ? marker : (fenceMarker === marker ? null : fenceMarker);
  return { inFence: nextInFence, fenceMarker: nextMarker, isFenceLine: true };
}

function applyHeadingLine(state, trimmed) {
  const headingMatch = trimmed.match(/^(#{1,6})\s+/);
  if (!headingMatch) return false;
  const level = headingMatch[1].length;
  while (state.sectionStack.length > 0 && state.sectionStack[state.sectionStack.length - 1].level >= level) state.sectionStack.pop();
  for (let pi = 0; pi < state.allowedEntries.length; pi++) {
    const pl = state.allowedEntries[pi].placement;
    if (pl && pl.headingMatch && pl.headingMatch.test(trimmed)) {
      state.sectionStack.push({ patternIndex: pi, level });
      state.sectionAnchorCount.set(pi, 0);
    }
  }
  return true;
}

function applyAnchorLine(state) {
  const { index, lines, allowedEntries, allowedPatterns, strictPlacement, onError } = state;
  const lineNumber = index + 1;
  const line = lines[index];
  const scanLine = stripInlineCode(line);
  const basicErr = getBasicAnchorError(scanLine, line, lineNumber, allowedPatterns);
  if (basicErr) { onError(basicErr); return; }
  const id = scanLine.match(ANCHOR_TAG_RE)[1];
  const matchIndex = allowedEntries.findIndex((e) => e.pattern.test(id));
  const rule = allowedEntries[matchIndex].placement;
  const placementErr = strictPlacement && rule
    ? getPlacementError({ lineNumber, line, trimmed: line.trim(), id, matchIndex, index, rule, sectionStack: state.sectionStack, sectionAnchorCount: state.sectionAnchorCount, lines })
    : null;
  if (placementErr) onError(placementErr);
}

function processLine(state) {
  const { index, lines } = state;
  const line = lines[index];
  const trimmed = line.trim();

  const fence = updateFenceState(trimmed, state.inFence, state.fenceMarker);
  if (fence.isFenceLine) {
    state.inFence = fence.inFence;
    state.fenceMarker = fence.fenceMarker;
    return;
  }
  if (state.inFence) return;
  if (applyHeadingLine(state, trimmed)) return;

  const scanLine = stripInlineCode(line);
  if (scanLine.indexOf("<a") === -1) return;

  applyAnchorLine(state);
}

module.exports = {
  names: ["allow-custom-anchors"],
  description:
    "Allow only configured <a id=\"...\"></a> anchor id patterns; optional placement rules.",
  tags: ["html", "anchors"],
  function: function (params, onError) {
    const { allowedEntries, strictPlacement } = getConfig(params);
    const allowedPatterns = allowedEntries.map((e) => e.pattern);
    const lines = params.lines;
    const state = {
      inFence: false,
      fenceMarker: null,
      sectionStack: [],
      sectionAnchorCount: new Map(),
      allowedEntries,
      allowedPatterns,
      strictPlacement,
      onError,
    };

    for (let index = 0; index < lines.length; index++) {
      state.index = index;
      state.lines = lines;
      processLine(state);
    }
  },
};
