"use strict";

/**
 * Unit tests for heading-min-words: headings at or below a level must have at least N words.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rule = require("../../markdownlint-rules/heading-min-words.js");
const { runRule } = require("./run-rule.js");

describe("heading-min-words", () => {
  it("reports no errors when all headings have at least 2 words (default)", () => {
    const lines = ["# Doc Title", "## First Section", "### Sub Section Here", "Content."];
    const config = { "heading-min-words": { minWords: 2 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports error for single-word heading when minWords is 2", () => {
    const lines = ["# Doc", "## Foo", "Content.", "## Bar Baz", "More."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
    assert.ok(errors[0].detail.includes("at least 2 word(s)"));
    assert.ok(errors[0].detail.includes("found 1"));
  });

  it("reports no error for two-word heading with minWords 2", () => {
    const lines = ["# Doc", "## Foo Bar", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("strips numbering by default and counts words after prefix", () => {
    const lines = ["# Doc", "#### Foo", "Content.", "## 1.2. Bar Baz", "More."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 4 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("passes when numbered H4 has two words after prefix", () => {
    const lines = ["# Doc", "#### Foo Bar", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 4 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("allowList allows single-word titles in list", () => {
    const lines = ["# Doc", "## Overview", "## References", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, allowList: ["Overview", "References"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("reports single-word not in allowList", () => {
    const lines = ["# Doc", "## Summary", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, allowList: ["Overview"] } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 2);
  });

  it("applyToLevelsAtOrBelow: 4 only checks H4 and deeper", () => {
    const lines = ["# Doc", "## One", "### Two", "#### Three", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 4 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].lineNumber, 4);
  });

  it("minLevel/maxLevel restricts which levels are checked", () => {
    const lines = ["# Doc", "## A", "### B", "#### C", "Content."];
    const config = { "heading-min-words": { minWords: 2, minLevel: 2, maxLevel: 3 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 2);
    const linesReported = errors.map((e) => e.lineNumber).sort((a, b) => a - b);
    assert.deepStrictEqual(linesReported, [2, 3]);
  });

  it("excludePaths skips file", () => {
    const lines = ["# Doc", "## Foo", "Content."];
    const config = { "heading-min-words": { minWords: 2, excludePaths: ["**/skip.md"] } };
    const errors = runRule(rule, lines, config, "path/skip.md");
    assert.strictEqual(errors.length, 0);
  });

  it("includePaths only runs for matching file", () => {
    const lines = ["# Doc", "## Foo", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, includePaths: ["**/check.md"] } };
    const errorsRun = runRule(rule, lines, config, "path/check.md");
    const errorsSkip = runRule(rule, lines, config, "path/other.md");
    assert.strictEqual(errorsRun.length, 1);
    assert.strictEqual(errorsSkip.length, 0);
  });

  it("stripNumbering: false counts full heading text", () => {
    const lines = ["# Doc", "## 1.2.3 Full Title Here", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, stripNumbering: false } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 0);
  });

  it("uses default minWords 2 when invalid", () => {
    const lines = ["# Doc", "## X", "Content."];
    const errors = runRule(rule, lines, { "heading-min-words": { minWords: 0, applyToLevelsAtOrBelow: 2 } });
    assert.strictEqual(errors.length, 1);
  });

  it("reports heading with empty or minimal title when in scope", () => {
    const lines = ["# Doc", "## 1. First", "#### 1.1.1. ", "Content."];
    const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 4 } };
    const errors = runRule(rule, lines, config);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].detail.includes("word(s)") && errors[0].detail.includes("found"));
  });

  describe("HTML comment suppress", () => {
    it("reports no error when suppress comment on previous line before single-word heading", () => {
      const lines = ["# Doc", "<!-- heading-min-words allow -->", "## Foo", "Content."];
      const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 0);
    });

    it("reports no error when heading line ends with suppress comment", () => {
      const lines = ["# Doc", "## Foo <!-- heading-min-words allow -->", "Content."];
      const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 0);
    });

    it("reports error when wrong rule name in comment on previous line", () => {
      const lines = ["# Doc", "<!-- ascii-only allow -->", "## Foo", "Content."];
      const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 3);
    });
  });

  describe("edge cases", () => {
    it("allowList is case-insensitive (Overview matches overview)", () => {
      const lines = ["# Doc", "## overview", "Content."];
      const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, allowList: ["Overview"] } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 0);
    });

    it("applyToLevelsAtOrBelow 1 includes H1 in scope", () => {
      const lines = ["# One", "## Two Words", "Content."];
      const config = { "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 1 } };
      const errors = runRule(rule, lines, config);
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].lineNumber, 1);
    });

    it("excludePathPatterns skips when path matches exclude even if it matches include", () => {
      const lines = ["# Doc", "## Foo", "Content."];
      const config = {
        "heading-min-words": { minWords: 2, applyToLevelsAtOrBelow: 2, includePaths: ["**/*.md"], excludePaths: ["**/foo.md"] },
      };
      const errors = runRule(rule, lines, config, "docs/foo.md");
      assert.strictEqual(errors.length, 0, "excluded path should skip rule");
    });
  });
});
