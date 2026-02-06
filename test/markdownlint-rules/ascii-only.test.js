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
  });

  it("reports no errors when path matches allowedPathPatternsUnicode", () => {
    // Glob "*.md" matches "doc.md"; non-ASCII is allowed in that file.
    const lines = ["Café"];
    const errors = runRule(rule, lines, {
      allowedPathPatternsUnicode: ["*.md"],
    }, "doc.md");
    assert.strictEqual(errors.length, 0);
  });
});
