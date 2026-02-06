"use strict";

/**
 * Unit tests for no-duplicate-headings-normalized: disallow duplicate heading
 * titles after stripping numeric prefixes and normalizing (trim, collapse
 * whitespace, lowercase). The rule reports duplicates and references the
 * first occurrence by line number.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/no-duplicate-headings-normalized.js");
const { runRule } = require("./run-rule.js");

describe("no-duplicate-headings-normalized", () => {
  it("reports no errors when headings are unique", () => {
    const lines = ["# First", "## Second", "## Third"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for duplicate normalized title", () => {
    // Same text at different levels still normalizes to the same key.
    const lines = ["# Introduction", "Content.", "## Introduction"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("Duplicate"));
    assert.ok(errors[0].detail.includes("line 1"));
  });

  it("reports error when numbering differs but title same", () => {
    // Numbering is stripped; "1. Overview" and "2. Overview" both normalize to "overview".
    const lines = ["## 1. Overview", "Text.", "## 2. Overview"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
  });
});
