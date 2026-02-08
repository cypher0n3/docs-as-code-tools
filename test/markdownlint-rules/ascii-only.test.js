"use strict";

/**
 * Unit tests for ascii-only: disallow non-ASCII characters except in paths
 * matching allowedPathPatternsUnicode (or allowedPathPatternsEmoji for
 * emoji-only). The rule is path-aware, so we pass a fake file name (name)
 * when invoking it.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/ascii-only.js");
const { runRule } = require("./run-rule.js");

describe("ascii-only", () => {
  it("reports no errors for ASCII-only content", () => {
    const lines = ["# Title", "Plain ASCII text."];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for non-ASCII when path not allowlisted", () => {
    // Accented characters (é, ï) are reported when path is not in allowlist.
    const lines = ["Café and naïve"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("ASCII") || e.detail.includes("U+")));
    const withRange = errors.find((e) => Array.isArray(e.range) && e.range.length === 2);
    assert.ok(withRange, "at least one error should include range [column, length] for the violating character");
    assert.ok(withRange.detail.includes("U+") || withRange.detail.includes("'"), "detail should identify the character or code point");
  });

  it("reports no errors when path matches allowedPathPatternsUnicode", () => {
    // Glob "*.md" matches "doc.md"; non-ASCII is allowed in that file.
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["*.md"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error with emoji-list message when path is emoji-only and char not in list", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("not in allowed emoji") || e.detail.includes("U+")), "detail should mention emoji list or code point");
  });

  it("allows non-ASCII when path matches relative pattern (utils matchGlob **/ branch)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["foo.md"],
    }, "sub/foo.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports error when path does not match any unicode pattern (utils pathMatchesAny)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["other.md"],
    }, "doc.md");
    assert.ok(errors.length >= 1);
  });

  it("skips content inside ~~~ fenced block (utils iterateNonFencedLines)", () => {
    const lines = ["~~~", "Café inside tildes", "~~~", "Plain"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when path is emoji-only and content has only allowed emoji", () => {
    const lines = ["Hello \u263A"]; // ☺ in allowed list
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when path is emoji-only and content has emoji plus variation selector", () => {
    const lines = ["\u263A\uFE00"]; // ☺ + variation selector
    const errors = runRule(rule, lines, {
      allowedPathPatternsEmoji: ["*.md"],
      allowedEmoji: ["\u263A"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors when non-ASCII char is in allowedUnicode set", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedUnicode: ["\u00E9"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("includes suggested replacement when unicodeReplacements is object", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: { "\u00E9": "e" },
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("suggested replacement") && e.detail.includes("e")));
  });

  it("includes suggested replacement when unicodeReplacements is array", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: [["\u00E9", "e"]],
    }, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("suggested replacement")));
  });

  it("formats astral character with 6-digit code point in error", () => {
    const lines = ["\u{1F600}"]; // 😀
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => /U\+[0-9A-F]{6}/.test(e.detail)), "astral code point should be 6 hex digits");
  });

  it("strips inline code before checking (utils stripInlineCode fence match)", () => {
    const lines = ["Café ``code``"];
    const errors = runRule(rule, lines, {}, "doc.md");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("Café") || e.detail.includes("U+")));
  });

  it("skips non-string entries in path patterns (utils pathMatchesAny)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["*.md", 123],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("handles empty pattern in path list (utils matchGlob)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["", "*.md"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });

  it("uses default replacements when unicodeReplacements is falsy (buildReplacementsMap early return)", () => {
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      unicodeReplacements: "",
    }, "doc.md");
    assert.ok(errors.length >= 1);
  });
});
