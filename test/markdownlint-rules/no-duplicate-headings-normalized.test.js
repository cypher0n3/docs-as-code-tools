"use strict";

/**
 * Unit tests for no-duplicate-headings-normalized: disallow duplicate heading
 * titles after stripping numeric prefixes and normalizing (trim, collapse
 * whitespace, lowercase). The rule reports duplicates and references the
 * first occurrence by line number.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/no-duplicate-headings-normalized.js");
const { runRule } = require("./run-rule.js");

describe("no-duplicate-headings-normalized", () => {
  it("reports no errors when headings are unique", () => {
    const lines = ["# First", "## Second", "## Third"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns", () => {
    const lines = ["# Introduction", "## Introduction"];
    const config = { excludePathPatterns: ["**/excluded.md"] };
    const errors = runRule(rule, lines, config, "docs/excluded.md");
    assert.strictEqual(errors.length, 0);
  });

  it("skips heading that normalizes to empty (no key)", () => {
    const lines = ["##  ", "## Section", "content"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips multiple headings that normalize to empty (continue branch)", () => {
    const lines = ["##  ", "###  ", "## Real", "content"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("single heading that normalizes to empty hits continue (branch coverage)", () => {
    const lines = ["##  ", "body"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("skips when file path matches excludePathPatterns (rule-level config)", () => {
    const lines = ["# A", "## A"];
    const config = { "no-duplicate-headings-normalized": { excludePathPatterns: ["**"] } };
    const errors = runRule(rule, lines, config, "any.md");
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
    assert.ok(errors[0].detail.includes("introduction"), "detail should include the normalized duplicate title");
  });

  it("reports error when numbering differs but title same", () => {
    // Numbering is stripped; "1. Overview" and "2. Overview" both normalize to "overview".
    const lines = ["## 1. Overview", "Text.", "## 2. Overview"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 3);
    assert.ok(errors[0].detail.includes("overview"), "detail should include the normalized duplicate title");
    assert.ok(errors[0].detail.includes("line 1"), "detail should reference first occurrence line");
  });

  it("normalizes empty heading title (utils normalizeHeadingTitleForDup)", () => {
    const lines = ["# ", "## Section", "content"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 0);
  });

  it("reports multiple duplicates when same normalized title appears three times", () => {
    const lines = ["# Overview", "## 1. Overview", "## 2. Overview"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 2);
    assert.ok(errors.every((e) => e.detail.includes("Overview") || e.detail.includes("overview")));
    assert.ok(errors.some((e) => e.detail.includes("line 1")));
  });

  it("suppress comment on previous line skips duplicate error for that line (branch coverage)", () => {
    const lines = ["# A", "## A", "<!-- no-duplicate-headings-normalized allow -->", "## A"];
    const errors = runRule(rule, lines);
    assert.strictEqual(errors.length, 1, "only first duplicate reported; third suppressed by comment");
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("uses top-level config when rule key absent (branch coverage)", () => {
    const lines = ["# Same", "## Same"];
    const config = { "other-rule": {}, default: true };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
  });

  describe("edge cases", () => {
    it("duplicate with different casing and whitespace normalizes to same key", () => {
      const lines = ["##  Introduction  ", "Content.", "##  INTRODUCTION"];
      const errors = runRule(rule, lines);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 3);
      assert.ok(errors[0].detail.toLowerCase().includes("introduction"));
    });

    it("config from rule-level key no-duplicate-headings-normalized", () => {
      const lines = ["# A", "## A"];
      const config = { "no-duplicate-headings-normalized": { excludePathPatterns: [] } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
    });
  });
});
