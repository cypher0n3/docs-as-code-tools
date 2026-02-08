"use strict";

const {
  iterateLinesWithFenceInfo,
  iterateNonFencedLines,
  pathMatchesAny,
  stripInlineCode,
} = require("./utils.js");

const DEFAULT_UNICODE_REPLACEMENTS = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<=>",
  "\u21D2": "=>",
  "\u21D0": "<=",
  "\u21D4": "<=>",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u00D7": "*",
  "\u2033": "\"",
  "\u2032": "'",
  "\u201C": "\"",
  "\u201D": "\"",
  "\u2019": "'",
  "\u2018": "'",
};

/**
 * Common non-English letters allowed by default (config allowedUnicode extends this).
 * Escape → character:
 * 00E9→é 00EF→ï 00E8→è 00EA→ê 00EB→ë 00E0→à 00E2→â 00E4→ä
 * 00F9→ù 00FB→û 00FC→ü 00F4→ô 00F6→ö 00EE→î 00FF→ÿ 00F1→ñ
 * 00E7→ç 00E1→á 00ED→í 00F3→ó 00FA→ú 00E3→ã 00F5→õ 00E6→æ
 * 0153→œ 00F0→ð 00FE→þ 00F8→ø 00E5→å
 * 00C9→É 00CF→Ï 00C8→È 00CA→Ê 00CB→Ë 00C0→À 00C2→Â 00C4→Ä
 * 00D9→Ù 00DB→Û 00DC→Ü 00D4→Ô 00D6→Ö 00CE→Î 00D1→Ñ
 * 00C7→Ç 00C1→Á 00CD→Í 00D3→Ó 00DA→Ú 00C3→Ã 00D5→Õ 00C6→Æ 0152→Œ
 */
const DEFAULT_ALLOWED_UNICODE = [
  "\u00E9", "\u00EF", "\u00E8", "\u00EA", "\u00EB", "\u00E0", "\u00E2", "\u00E4",
  "\u00F9", "\u00FB", "\u00FC", "\u00F4", "\u00F6", "\u00EE", "\u00FF", "\u00F1",
  "\u00E7", "\u00E1", "\u00ED", "\u00F3", "\u00FA", "\u00E3", "\u00F5", "\u00E6",
  "\u0153", "\u00F0", "\u00FE", "\u00F8", "\u00E5", "\u00C9", "\u00CF", "\u00C8",
  "\u00CA", "\u00CB", "\u00C0", "\u00C2", "\u00C4", "\u00D9", "\u00DB", "\u00DC",
  "\u00D4", "\u00D6", "\u00CE", "\u00D1", "\u00C7", "\u00C1", "\u00CD", "\u00D3",
  "\u00DA", "\u00C3", "\u00D5", "\u00C6", "\u0152",
];

/**
 * Return true if the string contains any non-ASCII character (code point > 0x7F).
 * @param {string} str - Input string
 * @returns {boolean}
 */
function hasNonAscii(str) {
  return /[\u0080-\u{10FFFF}]/u.test(str);
}

/**
 * Return non-ASCII code points as array (iterating by code point so surrogates stay as one).
 * @param {string} str - Input string
 * @returns {string[]} Array of non-ASCII characters
 */
function getNonAsciiCodePoints(str) {
  const result = [];
  for (const ch of str) {
    if (ch.codePointAt(0) > 0x7f) {
      result.push(ch);
    }
  }
  return result;
}

const VARIATION_SELECTOR_MIN = "\uFE00";
const VARIATION_SELECTOR_MAX = "\uFE0F";

/**
 * Return true if all non-ASCII in str are in allowedSet or are variation selectors (U+FE00–U+FE0F).
 * @param {string} str - Input string
 * @param {Set<string>} allowedSet - Allowed emoji (NFC-normalized)
 * @returns {boolean}
 */
function onlyAllowedEmoji(str, allowedSet) {
  const nonAscii = getNonAsciiCodePoints(str);
  if (nonAscii.length === 0) {
    return true;
  }
  for (const ch of nonAscii) {
    const n = ch.normalize("NFC");
    if (allowedSet.has(n)) {
      continue;
    }
    if (
      n >= VARIATION_SELECTOR_MIN &&
      n <= VARIATION_SELECTOR_MAX
    ) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Add replacement entries from an array of [char, replacement] pairs.
 * @param {Map<string, string>} map - Map to mutate
 * @param {Array<[string, string]>} arr - Array of [singleChar, replacement]
 */
function addArrayReplacements(map, arr) {
  for (const entry of arr) {
    if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === "string" && entry[0].length === 1) {
      map.set(entry[0], String(entry[1]));
    }
  }
}

/**
 * Add replacement entries from an object (char -> replacement).
 * @param {Map<string, string>} map - Map to mutate
 * @param {object} obj - Object with single-char keys and string values
 */
function addObjectReplacements(map, obj) {
  for (const [ch, replacement] of Object.entries(obj)) {
    if (typeof ch === "string" && ch.length === 1 && replacement != null) {
      map.set(ch, String(replacement));
    }
  }
}

/**
 * Build a Map of non-ASCII char -> suggested replacement from config (array or object).
 * @param {Array<[string, string]>|object} [unicodeReplacements] - Config array or object
 * @returns {Map<string, string>}
 */
function buildReplacementsMap(unicodeReplacements) {
  const map = new Map();
  if (!unicodeReplacements || typeof unicodeReplacements !== "object") {
    return map;
  }
  if (Array.isArray(unicodeReplacements)) {
    addArrayReplacements(map, unicodeReplacements);
    return map;
  }
  addObjectReplacements(map, unicodeReplacements);
  return map;
}

/**
 * Convert array of strings to a Set of NFC-normalized characters (one code point per string item).
 * @param {string[]} [arr] - Array of strings (each treated as one or more chars)
 * @returns {Set<string>}
 */
function toCharSet(arr) {
  const set = new Set();
  if (!Array.isArray(arr)) {
    return set;
  }
  for (const item of arr) {
    if (typeof item === "string" && item.length >= 1) {
      const normalized = item.normalize("NFC");
      for (const ch of normalized) {
        set.add(ch);
      }
    }
  }
  return set;
}

/**
 * Build rule config: path patterns, allowed emoji/unicode, and unicodeReplacements map.
 * @param {{ config?: object }} params - markdownlint params
 * @returns {object} Config object
 */
function getConfig(params) {
  const c = params.config || {};
  const defaultSet = toCharSet(DEFAULT_ALLOWED_UNICODE);
  const configSet = toCharSet(c.allowedUnicode);
  const replaceDefault = c.allowedUnicodeReplaceDefault === true;
  const allowedUnicodeSet = replaceDefault
    ? configSet
    : new Set([...defaultSet, ...configSet]);
  const disallowTypesRaw = Array.isArray(c.disallowUnicodeInCodeBlockTypes)
    ? c.disallowUnicodeInCodeBlockTypes
    : [];
  const disallowUnicodeInCodeBlockTypesSet = new Set(
    disallowTypesRaw.filter((t) => typeof t === "string").map((t) => String(t).trim().toLowerCase()),
  );
  return {
    allowedPathPatternsUnicode: Array.isArray(c.allowedPathPatternsUnicode)
      ? c.allowedPathPatternsUnicode
      : [],
    allowedPathPatternsEmoji: Array.isArray(c.allowedPathPatternsEmoji)
      ? c.allowedPathPatternsEmoji
      : [],
    allowedEmoji: Array.isArray(c.allowedEmoji) ? c.allowedEmoji : [],
    allowedUnicode: allowedUnicodeSet,
    allowUnicodeInCodeBlocks: c.allowUnicodeInCodeBlocks !== false,
    disallowUnicodeInCodeBlockTypes: disallowUnicodeInCodeBlockTypesSet,
    unicodeReplacements: buildReplacementsMap(
      c.unicodeReplacements ?? DEFAULT_UNICODE_REPLACEMENTS,
    ),
  };
}

/**
 * Iterate over disallowed non-ASCII occurrences in scan.
 * Yields { startIndex, char, length } (char may be 1 or 2 code units for astral chars).
 * @param {string} scan - Line with inline code stripped
 * @param {boolean} allowEmojiOnly - Whether only emoji are allowed (path-based)
 * @param {Set<string>} allowedUnicodeSet - Allowed non-ASCII chars (NFC)
 * @param {Set<string>} allowedEmojiSet - Allowed emoji (NFC)
 * @yields {{ startIndex: number, char: string, length: number }}
 */
function* getDisallowedOccurrences(scan, allowEmojiOnly, allowedUnicodeSet, allowedEmojiSet) {
  for (let i = 0; i < scan.length; i++) {
    const cp = scan.codePointAt(i);
    if (cp <= 0x7f) continue;
    const len = cp > 0xffff ? 2 : 1;
    const ch = scan.slice(i, i + len);
    const n = ch.normalize("NFC");
    if (allowedUnicodeSet.has(n)) { i += len - 1; continue; }
    if (allowEmojiOnly && allowedEmojiSet.has(n)) { i += len - 1; continue; }
    if (allowEmojiOnly && n >= VARIATION_SELECTOR_MIN && n <= VARIATION_SELECTOR_MAX) { i += len - 1; continue; }
    yield { startIndex: i, char: ch, length: len };
    i += len - 1;
  }
}

/**
 * Format a single character as Unicode code point (e.g. "U+2192").
 * @param {string} ch - Single character (may be surrogate pair)
 * @returns {string}
 */
function formatCodePoint(ch) {
  const cp = ch.codePointAt(0);
  return "U+" + cp.toString(16).toUpperCase().padStart(cp <= 0xffff ? 4 : 6, "0");
}

/**
 * Build human-readable error detail for a disallowed character (code point + suggestion or reason).
 * @param {string} ch - The disallowed character
 * @param {string|undefined} replacement - Suggested replacement if any
 * @param {boolean} allowEmojiOnly - Whether rule is in emoji-only mode for this path
 * @param {object} config - Full config (e.g. allowedEmoji for message)
 * @returns {string}
 */
function buildOccurrenceDetail(ch, replacement, allowEmojiOnly, config) {
  const cpStr = formatCodePoint(ch);
  if (replacement !== undefined) {
    return `Character '${ch}' (${cpStr}); suggested replacement: '${replacement}'`;
  }
  if (allowEmojiOnly) {
    return `Character '${ch}' (${cpStr}) not in allowed emoji list (${config.allowedEmoji.join(", ")})`;
  }
  return `Character '${ch}' (${cpStr}) not allowed; use ASCII only`;
}

/**
 * Whether to check this line when it is inside a fenced code block (call only when allowUnicodeInCodeBlocks is false).
 * @param {boolean} inFencedBlock - Line is inside a fence
 * @param {string} blockType - Info string of the block (e.g. "text", "bash")
 * @param {Set<string>} disallowTypes - Block types to check (empty = check all)
 * @returns {boolean}
 */
function shouldCheckFencedLine(inFencedBlock, blockType, disallowTypes) {
  if (!inFencedBlock) return true;
  if (disallowTypes.size === 0) return true;
  return disallowTypes.has(blockType);
}

/**
 * markdownlint rule: disallow non-ASCII except in configured paths; optional
 * replacement suggestions via unicodeReplacements. Paths can allow full Unicode
 * or emoji-only. Unicode and emoji inside fenced code blocks or between
 * backticks (inline code) are ignored by default; use allowUnicodeInCodeBlocks
 * and disallowUnicodeInCodeBlockTypes to check inside code blocks.
 *
 * @param {object} params - markdownlint params (lines, name, config)
 * @param {function(object): void} onError - Callback to report an error
 */
function ruleFunction(params, onError) {
  const filePath = params.name || "";
  const config = getConfig(params);
  const allowUnicode = pathMatchesAny(filePath, config.allowedPathPatternsUnicode);
  const allowEmojiOnly = pathMatchesAny(filePath, config.allowedPathPatternsEmoji);
  const allowedEmojiSet = toCharSet(config.allowedEmoji);
  const allowedUnicodeSet = config.allowedUnicode;

  const checkLine = (lineNumber, line) => {
    const scan = stripInlineCode(line);
    if (!hasNonAscii(scan)) return;
    if (allowUnicode) return;
    if (allowEmojiOnly && onlyAllowedEmoji(scan, allowedEmojiSet)) return;

    for (const { startIndex, char, length } of getDisallowedOccurrences(
      scan, allowEmojiOnly, allowedUnicodeSet, allowedEmojiSet,
    )) {
      const column = startIndex + 1;
      const replacement = config.unicodeReplacements.get(char);
      onError({
        lineNumber,
        detail: buildOccurrenceDetail(char, replacement, allowEmojiOnly, config),
        context: line,
        range: [column, length],
      });
    }
  };

  if (config.allowUnicodeInCodeBlocks) {
    for (const { lineNumber, line } of iterateNonFencedLines(params.lines)) {
      checkLine(lineNumber, line);
    }
    return;
  }

  for (const { lineNumber, line, inFencedBlock, blockType } of iterateLinesWithFenceInfo(params.lines)) {
    if (!shouldCheckFencedLine(inFencedBlock, blockType, config.disallowUnicodeInCodeBlockTypes)) continue;
    checkLine(lineNumber, line);
  }
}

module.exports = {
  names: ["ascii-only"],
  description:
    "Disallow non-ASCII except in configured paths; optional replacement suggestions via unicodeReplacements.",
  tags: ["content"],
  function: ruleFunction,
};
