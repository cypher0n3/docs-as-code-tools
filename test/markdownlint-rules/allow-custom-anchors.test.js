"use strict";

/**
 * Unit tests for allow-custom-anchors: allow only <a id="..."></a> anchors
 * whose ids match configured regex patterns (allowedIdPatterns). When no
 * patterns are set, no anchors are validated; when set, non-matching ids
 * are reported.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/allow-custom-anchors.js");
const { runRule } = require("./run-rule.js");

describe("allow-custom-anchors", () => {
  it("reports no errors when no anchors and no config", () => {
    const lines = ["# Title", "Content"];
    const errors = runRule(rule, lines, {});
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for anchor id not matching allowed pattern", () => {
    // allowedIdPatterns: only ids starting with "spec-" are allowed.
    const lines = ["<a id=\"custom\"></a>", "Content"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 1);
    assert.ok(errors[0].detail.includes("allowed") || errors[0].detail.includes("pattern"));
  });

  it("reports no errors when anchor id matches allowed pattern", () => {
    const lines = ["<a id=\"spec-intro\"></a>", "Content"];
    const errors = runRule(rule, lines, { allowedIdPatterns: ["^spec-"] });
    assert.strictEqual(errors.length, 0);
  });
});
