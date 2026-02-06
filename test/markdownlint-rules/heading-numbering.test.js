"use strict";

/**
 * Unit tests for heading-numbering: enforce consistent numbered headings
 * (segment count by numbering root, sequential numbering within a section,
 * consistent period style). The rule only runs when at least one heading
 * has a number prefix; unnumbered headings are ignored.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../.markdownlint-rules/heading-numbering.js");
const { runRule } = require("./run-rule.js");

describe("heading-numbering", () => {
  it("reports no errors when no numbered headings", () => {
    const lines = ["# Title", "## Section", "Content"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports no errors for consistent numbering", () => {
    // Siblings 1., 2.; subsection 2.1. under 2. is valid.
    const lines = ["# Doc", "## 1. First", "## 2. Second", "### 2.1. Sub"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for non-sequential numbering in section", () => {
    // After 1. and 2., next sibling should be 3., not 4.
    const lines = ["# Doc", "## 1. First", "## 2. Second", "## 4. Skip"];
    const errors = runRule(rule, lines);
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((e) => e.detail.includes("expected") || e.detail.includes("Non-sequential")));
  });
});
